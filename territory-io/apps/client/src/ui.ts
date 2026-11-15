import type { DeadMsg, EndMsg, LobbyMsg, Mode } from '@territory/shared';
import { bus } from './bus';
import { net } from './net';
import { sfx } from './audio';
import { profile, save } from './store';
import { RARITY_COLOR, SKINS, skinCss, skinOf } from './skins';
import { esc, hud } from './hud';

const root = document.getElementById('ui')!;
type Screen = '' | 'menu' | 'friends' | 'lobby' | 'skins' | 'board' | 'profile' | 'settings' | 'daily' | 'results' | 'pause' | 'dead';
let current: Screen = '';
let online = 0;
let connected = false;
let slowConnect = false;
let mode: Mode = 'classic';
let lobby: LobbyMsg | null = null;
let nextTimer = 0;
const MODE_INFO: Record<Mode, { title: string; blurb: string }> = {
  classic: { title: 'Classic', blurb: '2:30 round. Respawn after you are eliminated. Highest territory wins.' },
  survival: { title: 'Survival', blurb: 'One life. Last player standing wins, or most land when time runs out.' }
};

const chip = (skin: number, cls = '') => `<span class="chip ${skinOf(skin).kind === 'anim' ? 'anim' : ''} ${cls}" style="background:${skinCss(skin)}"></span>`;
const today = () => new Date().toISOString().slice(0, 10);
const coinPill = () => `<div class="coins"><i></i>${profile.coins}</div>`;
const back = (to: Screen = 'menu') => `<button class="btn ghost back" data-go="${to}">Back</button>`;

function show(s: Screen, html = ''): void {
  current = s;
  root.className = s ? 'on' : '';
  root.innerHTML = html;
  root.querySelectorAll<HTMLElement>('[data-go]').forEach(b => b.onclick = () => { sfx.unlock(); sfx.click(); go(b.dataset.go as Screen); });
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function go(s: Screen): void {
  clearInterval(nextTimer);
  ({ menu, friends, lobby: lobbyScreen, skins, board, profile: profileScreen, settings, daily, results: () => {}, pause, dead: () => {}, '': () => show('') } as Record<string, () => void>)[s]?.();
}

function paintStatus(): void {
  const el = root.querySelector('.status');
  if (!el) return;
  const msg = connected ? `${online} player${online === 1 ? '' : 's'} online`
    : slowConnect ? 'Cannot reach the game server yet. It may be waking up (up to 1 min) or not deployed as a Web Service.'
    : 'Connecting to server...';
  el.innerHTML = `<i class="${connected ? 'ok' : ''}"></i>${msg}`;
}

// ---------------- menu ----------------
function menu(): void {
  show('menu', `
  <div class="menu">
    ${coinPill()}
    <h1 class="logo">TERRITORY<span>.IO</span></h1>
    <div class="status"><i class="${connected ? 'ok' : ''}"></i>${connected ? `${online} player${online === 1 ? '' : 's'} online` : 'Connecting to server...'}</div>
    <div class="namebox">${chip(profile.skin, 'lg')}<input id="name" maxlength="14" value="${esc(profile.name)}" aria-label="Your name" /></div>
    <button class="btn primary big" id="host">Host a Game</button>
    <div class="joinrow"><input id="code" maxlength="5" placeholder="ROOM CODE" autocapitalize="characters" aria-label="Room code" /><button class="btn big" id="join">Join</button></div>
    <p class="err" id="err"></p>
    <div class="grid2">
      <button class="btn" data-go="skins">Skin Collection</button>
      <button class="btn" data-go="board">Leaderboard</button>
      <button class="btn" data-go="profile">Profile</button>
      <button class="btn" data-go="settings">Settings</button>
    </div>
    <button class="btn gift" data-go="daily">Daily Reward${profile.daily.last === today() ? '' : '  •  ready'}</button>
    <p class="credit">Created by <b>Sahil Akhtar</b></p>
  </div>`);
  const name = $<HTMLInputElement>('name');
  name.onchange = () => { profile.name = name.value.trim().slice(0, 14) || profile.name; name.value = profile.name; save(); };
  const saveName = () => name.onchange!(new Event('change'));
  const offline = () => {
    if (connected) return false;
    $('err').textContent = 'Not connected to the game server yet. Wait a moment and try again.';
    return true;
  };
  $('host').onclick = () => { sfx.unlock(); sfx.click(); saveName(); if (!offline()) go('friends'); };
  const doJoin = () => { sfx.unlock(); sfx.click(); saveName(); if (!offline()) net.join($<HTMLInputElement>('code').value); };
  $('join').onclick = doJoin;
  $<HTMLInputElement>('code').onkeydown = e => { if (e.key === 'Enter') doJoin(); };
}

function modeCards(): string {
  return (Object.keys(MODE_INFO) as Mode[]).map(m => `
    <button class="mode ${m === mode ? 'sel' : ''}" data-mode="${m}"><b>${MODE_INFO[m].title}</b><span>${MODE_INFO[m].blurb}</span></button>`).join('');
}
function bindModes(): void {
  root.querySelectorAll<HTMLElement>('[data-mode]').forEach(b => b.onclick = () => {
    mode = b.dataset.mode as Mode; sfx.click();
    root.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('sel', x === b));
  });
}

function friends(): void {
  show('friends', `<div class="panel"><h2>Host a Game</h2>
    <p class="sub">You create the room, friends join with the code or link from any Wi-Fi or mobile data.</p>
    <div class="modes">${modeCards()}</div>
    <label class="check"><input type="checkbox" id="bots" checked /> Fill empty spots with bots</label>
    <button class="btn primary big" id="create">Create Room</button>
    <p class="err" id="err"></p>${back()}</div>`);
  bindModes();
  $('create').onclick = () => {
    sfx.click();
    if (!connected) { $('err').textContent = 'Not connected to the game server. Go back and wait for the green dot.'; return; }
    net.create(mode, ($('bots') as HTMLInputElement).checked);
  };
}

function lobbyScreen(): void {
  if (!lobby) return go('menu');
  const l = lobby, link = `${location.origin}/?room=${l.code}`;
  show('lobby', `<div class="panel"><h2>${MODE_INFO[l.mode].title} room</h2>
    <div class="code" id="codebox">${l.code}</div>
    <div class="row"><button class="btn" id="copy">Copy invite link</button></div>
    <ul class="players">${l.players.map(p => `<li>${chip(p.skin)}<span>${esc(p.name)}</span>${p.host ? '<em>host</em>' : ''}</li>`).join('')}</ul>
    ${l.youHost ? `<button class="btn primary big" id="start">Start Match</button>` : '<p class="sub">Waiting for the host to start...</p>'}
    <button class="btn ghost" id="leave">Leave room</button></div>`);
  $('copy').onclick = async () => {
    sfx.click();
    try { await navigator.clipboard.writeText(link); $('copy').textContent = 'Link copied'; }
    catch { $('copy').textContent = link; }
  };
  if (l.youHost) $('start').onclick = () => { sfx.click(); net.start(); };
  $('leave').onclick = () => { net.leave(); lobby = null; sfx.click(); go('menu'); };
}

// ---------------- skins ----------------
function skins(): void {
  const cards = SKINS.map(s => {
    const owned = profile.owned.includes(s.id), eq = profile.skin === s.id;
    const act = eq ? '<button class="btn sm" disabled>Equipped</button>'
      : owned ? `<button class="btn sm" data-eq="${s.id}">Equip</button>`
      : `<button class="btn sm primary" data-buy="${s.id}" ${profile.coins < s.price ? 'disabled' : ''}>${s.price} coins</button>`;
    return `<div class="skin ${eq ? 'eq' : ''}"><div class="prev ${s.kind === 'anim' ? 'anim' : ''}" style="background:${skinCss(s.id)}"></div>
      <b>${s.name}</b><em style="color:${RARITY_COLOR[s.rarity]}">${s.rarity}</em>${act}</div>`;
  }).join('');
  show('skins', `<div class="panel wide"><h2>Skin Collection</h2>${coinPill()}<div class="skin-grid">${cards}</div>${back()}</div>`);
  root.querySelectorAll<HTMLElement>('[data-eq]').forEach(b => b.onclick = () => { profile.skin = +b.dataset.eq!; save(); sfx.click(); skins(); });
  root.querySelectorAll<HTMLElement>('[data-buy]').forEach(b => b.onclick = () => {
    const s = SKINS[+b.dataset.buy!];
    if (profile.coins < s.price) return;
    profile.coins -= s.price; profile.owned.push(s.id); profile.skin = s.id; save(); sfx.capture(); skins();
  });
}

// ---------------- leaderboard / profile / settings / daily ----------------
async function board(tab: 'global' | 'weekly' = 'global'): Promise<void> {
  show('board', `<div class="panel wide"><h2>Leaderboard</h2><p class="sub">Loading...</p>${back()}</div>`);
  const data = await net.leaderboard();
  if (current !== 'board') return;
  const rows = data[tab];
  show('board', `<div class="panel wide"><h2>Leaderboard</h2>
    <div class="tabs"><button class="${tab === 'global' ? 'sel' : ''}" id="t-g">All time</button><button class="${tab === 'weekly' ? 'sel' : ''}" id="t-w">This week</button></div>
    ${rows.length ? `<table><thead><tr><th>#</th><th>Player</th><th>Best %</th><th>Wins</th><th>Kills</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.best}%</td><td>${r.wins}</td><td>${r.kills}</td></tr>`).join('')}</tbody></table>`
      : '<p class="sub">No finished rounds yet. Play a match to get on the board.</p>'}
    <p class="note">Rankings come from real rounds on this server and reset when it restarts (database storage is not added yet).</p>${back()}</div>`);
  $('t-g').onclick = () => board('global'); $('t-w').onclick = () => board('weekly');
}

function profileScreen(): void {
  const s = profile.stats, mins = Math.floor(s.playtime / 60);
  show('profile', `<div class="panel"><h2>Profile</h2>
    <div class="who">${chip(profile.skin, 'lg')}<div><b>${esc(profile.name)}</b><span>${skinOf(profile.skin).name} skin</span></div></div>
    <dl class="stats"><div><dt>Matches</dt><dd>${s.matches}</dd></div><div><dt>Wins</dt><dd>${s.wins}</dd></div>
    <div><dt>Eliminations</dt><dd>${s.kills}</dd></div><div><dt>Best territory</dt><dd>${s.best.toFixed(1)}%</dd></div>
    <div><dt>Playtime</dt><dd>${mins} min</dd></div><div><dt>Coins</dt><dd>${profile.coins}</dd></div></dl>
    <p class="note">Stats are saved on this device.</p>${back()}</div>`);
}

function settings(): void {
  show('settings', `<div class="panel"><h2>Settings</h2>
    <label class="slider">Volume<input type="range" id="vol" min="0" max="1" step="0.05" value="${profile.volume}" /></label>
    <label class="check"><input type="checkbox" id="mute" ${profile.muted ? 'checked' : ''} /> Mute all sound</label>
    <button class="btn ghost" id="reset">Reset local data</button>${back()}</div>`);
  $<HTMLInputElement>('vol').oninput = e => { sfx.unlock(); sfx.setVolume(+(e.target as HTMLInputElement).value); };
  $<HTMLInputElement>('vol').onchange = () => sfx.click();
  $<HTMLInputElement>('mute').onchange = e => sfx.setMuted((e.target as HTMLInputElement).checked);
  $('reset').onclick = () => { if (confirm('Erase your coins, skins and stats on this device?')) { localStorage.clear(); location.reload(); } };
}

function daily(): void {
  const ready = profile.daily.last !== today();
  const streak = ready ? profile.daily.streak + 1 : profile.daily.streak;
  const reward = 50 + 25 * Math.min(streak - 1, 6);
  show('daily', `<div class="panel"><h2>Daily Reward</h2>
    <p class="sub">${ready ? `Day ${streak} of your streak.` : 'You already collected today. Come back tomorrow.'}</p>
    <div class="bigcoins"><i></i>${ready ? '+' + reward : profile.daily.streak + '-day streak'}</div>
    ${ready ? '<button class="btn primary big" id="claim">Claim reward</button>' : ''}${back()}</div>`);
  if (ready) $('claim').onclick = () => {
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    profile.daily.streak = profile.daily.last === y ? profile.daily.streak + 1 : 1;
    profile.daily.last = today(); profile.coins += 50 + 25 * Math.min(profile.daily.streak - 1, 6);
    save(); sfx.win(); daily();
  };
}

function pause(): void {
  show('pause', `<div class="panel"><h2>Paused menu</h2><p class="sub">The match keeps running for other players.</p>
    <label class="slider">Volume<input type="range" id="vol" min="0" max="1" step="0.05" value="${profile.volume}" /></label>
    <button class="btn primary big" id="resume">Resume</button><button class="btn" id="quit">Leave match</button></div>`);
  $<HTMLInputElement>('vol').oninput = e => sfx.setVolume(+(e.target as HTMLInputElement).value);
  $('resume').onclick = () => { sfx.click(); show(''); };
  $('quit').onclick = () => leaveMatch();
}
function leaveMatch(): void { net.leave(); bus.emit('stop'); lobby = null; sfx.click(); go('menu'); }

// ---------------- results / death ----------------
function results(m: EndMsg): void {
  const me = m.ranking.find(r => r.id === m.you);
  const won = m.winner === m.you && !!me;
  const coins = me ? Math.round(me.best * 2) + me.kills * 10 + (won ? 50 : 0) : 0;
  if (me) {
    const s = profile.stats;
    s.matches++; s.kills += me.kills; s.best = Math.max(s.best, me.best); s.playtime += m.seconds;
    if (won) s.wins++;
    profile.coins += coins; save();
  }
  won ? sfx.win() : sfx.lose();
  hud.show(false);
  let left = m.next;
  const render = () => show('results', `<div class="panel wide"><h2>${won ? 'Victory!' : 'Round over'}</h2>
    <p class="sub">${me ? `You finished with ${me.best}% territory and ${me.kills} elimination${me.kills === 1 ? '' : 's'}. +${coins} coins.` : 'Spectated this round.'}</p>
    <table><thead><tr><th>#</th><th>Player</th><th>Land</th><th>Kills</th></tr></thead><tbody>
    ${m.ranking.map((r, i) => `<tr class="${r.id === m.you ? 'me' : ''}"><td>${i + 1}</td><td>${chip(r.skin)} ${esc(r.name)}${r.id === m.winner ? ' 👑' : ''}</td><td>${r.pct}%</td><td>${r.kills}</td></tr>`).join('')}
    </tbody></table>
    ${m.next ? `<p class="sub">Next round in ${left}s</p>` : '<p class="sub">Returning to the room...</p>'}
    <button class="btn" id="quit">Leave</button></div>`);
  render();
  $('quit').onclick = () => leaveMatch();
  if (m.next) nextTimer = window.setInterval(() => { left = Math.max(0, left - 1); if (current === 'results') { render(); $('quit').onclick = () => leaveMatch(); } }, 1000);
}

function dead(m: DeadMsg): void {
  if (current !== '') return;
  const who = m.by ? `Eliminated by ${esc(m.by)}` : m.reason === 'wall' ? 'You hit the wall' : m.reason === 'self' ? 'You crossed your own trail' : m.reason === 'lost' ? 'You lost all your land' : 'Head-on crash';
  show('dead', `<div class="toastbox"><b>${who}</b><span>${m.respawn ? 'Respawning...' : 'You are spectating. The round continues.'}</span>
    ${m.respawn ? '' : '<button class="btn sm" id="quit">Leave</button>'}</div>`);
  root.className = 'on passive';
  if (m.respawn) setTimeout(() => { if (current === 'dead') show(''); }, 2300);
  else $('quit').onclick = () => leaveMatch();
}

// ---------------- wiring ----------------
export function initUI(): void {
  hud.bind(() => pause());
  bus.on('net', ok => { connected = ok; if (ok) slowConnect = false; paintStatus(); });
  bus.on('online', n => { online = n; paintStatus(); });
  bus.on('lobby', (m: LobbyMsg) => { lobby = m; mode = m.mode; if (current !== 'pause') lobbyScreen(); hud.show(false); });
  bus.on('init', () => show(''));
  bus.on('end', (m: EndMsg) => results(m));
  bus.on('dead', (m: DeadMsg) => dead(m));
  bus.on('err', (e: string) => {
    const box = document.getElementById('err');
    if (box) box.textContent = e; else if (current === 'menu') { menu(); hud.toast(e); } else hud.toast(e);
  });
  setTimeout(() => { if (!connected) { slowConnect = true; paintStatus(); } }, 8000);
  menu();
  const room = new URLSearchParams(location.search).get('room');
  if (room) {
    history.replaceState(null, '', '/');
    const code = document.getElementById('code') as HTMLInputElement | null;
    if (code) { code.value = room.toUpperCase().slice(0, 5); hud.toast('Enter your name, then tap Join'); document.getElementById('name')?.focus(); }
  }
}

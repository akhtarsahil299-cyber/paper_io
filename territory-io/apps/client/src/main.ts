import Phaser from 'phaser';
import './styles/main.css';
import { GameScene } from './scenes/GameScene';
import { initUI } from './ui';
import { net } from './net';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8c96bf',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [GameScene]
});
initUI();
net.connect();

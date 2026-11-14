import Phaser from 'phaser';
import './styles/main.css';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0a0f1e',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [GameScene]
});

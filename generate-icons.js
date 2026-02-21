/**
 * Generate PNG icons for the Chrome extension.
 * Run: node generate-icons.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 128; // scale factor

  // Background circle
  ctx.beginPath();
  ctx.arc(64 * s, 64 * s, 60 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#FF9800';
  ctx.fill();

  // Inner circle for depth
  ctx.beginPath();
  ctx.arc(64 * s, 64 * s, 52 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#FFA726';
  ctx.fill();

  // Small red down-arrow (discount indicator)
  ctx.beginPath();
  ctx.moveTo(93 * s, 26 * s);
  ctx.lineTo(109 * s, 26 * s);
  ctx.lineTo(101 * s, 40 * s);
  ctx.closePath();
  ctx.fillStyle = '#F44336';
  ctx.fill();

  // "%" text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${42 * s}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('%', 64 * s, 50 * s);

  // "BW" text
  ctx.font = `bold ${28 * s}px Arial, Helvetica, sans-serif`;
  ctx.fillText('BW', 64 * s, 88 * s);

  return canvas.toBuffer('image/png');
}

for (const size of [16, 48, 128]) {
  const buf = drawIcon(size);
  fs.writeFileSync(`icon${size}.png`, buf);
  console.log(`Created icon${size}.png (${buf.length} bytes)`);
}

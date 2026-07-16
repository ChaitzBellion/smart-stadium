/** @module Chart */
import { createElement } from '../utils/dom.js';

export class Chart {
  /**
   * @param {HTMLElement} container 
   * @param {Object} options 
   * @param {string} options.type - 'line' | 'bar' | 'doughnut' | 'gauge'
   * @param {Array} options.data
   * @param {Object} options.options
   */
  constructor(container, options) {
    this.container = container;
    this.type = options.type || 'line';
    this.data = options.data || { labels: [], datasets: [] };
    this.options = options.options || {};
    
    this.canvas = createElement('canvas', {
      style: { width: '100%', height: '100%', display: 'block' },
      ariaLabel: this.options.ariaLabel || 'Data chart',
      role: 'img'
    });
    
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    
    this.resize();
  }
  
  resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    this.draw();
  }
  
  update(newData) {
    this.data = newData;
    this.draw();
  }
  
  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    if (this.type === 'line') {
      this.drawLineChart();
    } else if (this.type === 'gauge') {
      this.drawGaugeChart();
    }
    // More chart types can be implemented here
  }
  
  drawLineChart() {
    if (!this.data.datasets || this.data.datasets.length === 0) return;
    
    const dataset = this.data.datasets[0];
    const data = dataset.data;
    if (data.length === 0) return;
    
    const padding = 20;
    const chartWidth = this.width - padding * 2;
    const chartHeight = this.height - padding * 2;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const stepX = chartWidth / Math.max(1, data.length - 1);
    
    // Draw Area
    this.ctx.beginPath();
    this.ctx.moveTo(padding, this.height - padding);
    
    for (let i = 0; i < data.length; i++) {
      const x = padding + i * stepX;
      const y = this.height - padding - ((data[i] - min) / range) * chartHeight;
      this.ctx.lineTo(x, y);
    }
    
    this.ctx.lineTo(padding + (data.length - 1) * stepX, this.height - padding);
    this.ctx.closePath();
    
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, 'rgba(0, 210, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 210, 255, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    // Draw Line
    this.ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = padding + i * stepX;
      const y = this.height - padding - ((data[i] - min) / range) * chartHeight;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.strokeStyle = '#00d2ff';
    this.ctx.lineWidth = 3;
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
  }
  
  drawGaugeChart() {
    const dataset = this.data.datasets[0];
    const value = dataset.data[0];
    const max = this.options.max || 100;
    const percentage = Math.min(1, Math.max(0, value / max));
    
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    // Background arc
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 12;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
    
    // Value arc
    this.ctx.beginPath();
    const endAngle = 0.75 * Math.PI + (1.5 * Math.PI * percentage);
    this.ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, endAngle);
    
    // Color based on percentage
    if (percentage < 0.6) this.ctx.strokeStyle = '#00e676';
    else if (percentage < 0.85) this.ctx.strokeStyle = '#ffab00';
    else this.ctx.strokeStyle = '#ff5252';
    
    this.ctx.lineWidth = 12;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
    
    // Draw value text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 24px Outfit';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${Math.round(percentage * 100)}%`, centerX, centerY);
  }
  
  destroy() {
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }
}

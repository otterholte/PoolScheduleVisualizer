/**
 * EPIC Aquatic Center - Pool Schedule Visualizer
 * Premium SaaS-quality interface
 */

class PoolScheduleApp {
  constructor() {
    this.schedule = scheduleManager;
    this.currentDate = new Date();
    this.selectedDate = this.formatDate(this.currentDate);
    this.selectedTimeMinutes = this.getCurrentTimeMinutes();
    this.activeFilter = null;
    
    this.elements = {
      clock: document.getElementById('clock'),
      dateDisplay: document.getElementById('dateDisplay'),
      daySelector: document.getElementById('daySelector'),
      floorplanTitle: document.getElementById('floorplanTitle'),
      statusBadge: document.getElementById('statusBadge'),
      timeDisplay: document.getElementById('timeDisplay'),
      timeSlider: document.getElementById('timeSlider'),
      btnNow: document.getElementById('btnNow'),
      floorplan: document.getElementById('floorplan'),
      legendGrid: document.getElementById('legendGrid'),
      modalOverlay: document.getElementById('modalOverlay'),
      modalTitle: document.getElementById('modalTitle'),
      modalContent: document.getElementById('modalContent'),
      modalClose: document.getElementById('modalClose')
    };
  }

  async init() {
    try {
      await this.schedule.load();
      
      this.setupClock();
      this.renderDaySelector();
      this.renderLegend();
      this.setupEventListeners();
      this.updateTimeSlider();
      this.updateDisplay();
      
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  }

  setupClock() {
    const update = () => {
      const now = new Date();
      this.elements.clock.textContent = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      this.elements.dateDisplay.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    };
    update();
    setInterval(update, 1000);
  }

  renderDaySelector() {
    const container = this.elements.daySelector;
    container.innerHTML = '';
    
    // Get next 7 days
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(this.formatDate(date));
    }
    
    const todayStr = this.formatDate(new Date());
    
    dates.forEach(dateStr => {
      const date = new Date(dateStr + 'T12:00:00');
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const tab = document.createElement('button');
      tab.className = 'day-tab';
      tab.dataset.date = dateStr;
      
      if (dateStr === this.selectedDate) tab.classList.add('day-tab--active');
      if (dateStr === todayStr) tab.classList.add('day-tab--today');
      
      tab.innerHTML = `
        <span class="day-tab__name">${dayName}</span>
        <span class="day-tab__date">${monthDay}</span>
      `;
      
      tab.addEventListener('click', () => this.selectDate(dateStr));
      container.appendChild(tab);
    });
  }

  renderLegend() {
    const container = this.elements.legendGrid;
    container.innerHTML = '';
    
    const activities = this.schedule.getActivities();
    
    activities.forEach(activity => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.dataset.activity = activity.id;
      item.innerHTML = `
        <div class="legend-item__color" style="background: ${activity.color}"></div>
        <span class="legend-item__name">${activity.name}</span>
      `;
      item.addEventListener('click', () => this.toggleFilter(activity.id));
      container.appendChild(item);
    });
  }

  setupEventListeners() {
    // Time slider
    this.elements.timeSlider.addEventListener('input', (e) => {
      this.selectedTimeMinutes = parseInt(e.target.value, 10);
      this.updateDisplay();
    });
    
    // Now button
    this.elements.btnNow.addEventListener('click', () => {
      this.selectedDate = this.formatDate(new Date());
      this.selectedTimeMinutes = this.getCurrentTimeMinutes();
      this.updateTimeSlider();
      this.updateDisplay();
      this.highlightActiveDay();
    });
    
    // Modal close
    this.elements.modalClose.addEventListener('click', () => this.closeModal());
    this.elements.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.elements.modalOverlay) this.closeModal();
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
    
    // Pool lane clicks
    this.elements.floorplan.querySelectorAll('.pool-lane').forEach(lane => {
      lane.addEventListener('click', (e) => {
        e.stopPropagation();
        const section = lane.closest('[data-section]')?.dataset.section || 
                       lane.closest('g[id$="-lanes"]')?.id.replace('-lanes', '');
        const laneId = lane.dataset.lane;
        if (section && laneId) {
          this.showLaneDetails(section, laneId);
        }
      });
    });
  }

  selectDate(dateStr) {
    this.selectedDate = dateStr;
    this.highlightActiveDay();
    this.updateDisplay();
  }

  highlightActiveDay() {
    this.elements.daySelector.querySelectorAll('.day-tab').forEach(tab => {
      tab.classList.toggle('day-tab--active', tab.dataset.date === this.selectedDate);
    });
  }

  toggleFilter(activityId) {
    if (this.activeFilter === activityId) {
      this.activeFilter = null;
    } else {
      this.activeFilter = activityId;
    }
    
    // Update legend item states
    this.elements.legendGrid.querySelectorAll('.legend-item').forEach(item => {
      item.classList.toggle('legend-item--active', item.dataset.activity === this.activeFilter);
    });
    
    this.updateDisplay();
  }

  updateTimeSlider() {
    this.elements.timeSlider.value = this.selectedTimeMinutes;
  }

  updateDisplay() {
    // Update time display
    const timeStr = this.schedule.minutesToTimeString(this.selectedTimeMinutes);
    const isNow = this.selectedTimeMinutes === this.getCurrentTimeMinutes() && 
                  this.selectedDate === this.formatDate(new Date());
    this.elements.timeDisplay.textContent = isNow ? 'Now' : timeStr;
    
    // Update title
    const date = new Date(this.selectedDate + 'T12:00:00');
    const dateDisplay = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    this.elements.floorplanTitle.textContent = dateDisplay;
    
    // Update status badge
    const isOpen = this.schedule.isPoolOpen(this.selectedDate, this.selectedTimeMinutes);
    this.elements.statusBadge.innerHTML = isOpen ? 
      '<span>Pool Open</span>' : 
      '<span style="color: #ef4444;">Pool Closed</span>';
    this.elements.statusBadge.style.background = isOpen ? 
      'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    this.elements.statusBadge.style.borderColor = isOpen ? 
      'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    
    // Update pool lanes
    this.updatePoolLanes();
  }

  updatePoolLanes() {
    const lanes = this.elements.floorplan.querySelectorAll('.pool-lane');
    
    lanes.forEach(laneEl => {
      // Find section from parent
      let sectionId = null;
      const parentGroup = laneEl.closest('g[id$="-lanes"]');
      if (parentGroup) {
        sectionId = parentGroup.id.replace('-lanes', '');
      }
      
      if (!sectionId) return;
      
      const laneId = this.parseLaneId(laneEl.dataset.lane);
      const status = this.schedule.getLaneStatus(this.selectedDate, sectionId, laneId, this.selectedTimeMinutes);
      
      this.updateLaneVisual(laneEl, status);
    });
  }

  updateLaneVisual(laneEl, status) {
    // Reset styles
    laneEl.style.opacity = '1';
    laneEl.style.filter = '';
    
    if (!status) {
      // No activity - closed/unavailable
      laneEl.setAttribute('fill', '#374151');
      laneEl.style.opacity = '0.5';
      return;
    }
    
    const activity = status.activity;
    laneEl.setAttribute('fill', activity.color);
    
    // Apply filter highlight
    if (this.activeFilter) {
      if (activity.id === this.activeFilter) {
        laneEl.style.filter = 'brightness(1.3) drop-shadow(0 0 10px ' + activity.color + ')';
      } else {
        laneEl.style.opacity = '0.3';
      }
    }
  }

  showLaneDetails(sectionId, lane) {
    const section = this.schedule.getSection(sectionId);
    const laneSchedule = this.schedule.getLaneSchedule(this.selectedDate, sectionId, this.parseLaneId(lane));
    
    const sectionName = section?.name || sectionId;
    this.elements.modalTitle.textContent = `${sectionName} - Lane ${lane}`;
    
    if (laneSchedule.length === 0) {
      this.elements.modalContent.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          No scheduled activities for this lane today.
        </div>
      `;
    } else {
      this.elements.modalContent.innerHTML = laneSchedule.map(entry => `
        <div class="schedule-item">
          <div class="schedule-item__color" style="background: ${entry.activity.color}"></div>
          <span class="schedule-item__time">
            ${this.schedule.minutesToTimeString(this.schedule.timeToMinutes(entry.start))} - 
            ${this.schedule.minutesToTimeString(this.schedule.timeToMinutes(entry.end))}
          </span>
          <span class="schedule-item__name">${entry.activity.name}</span>
        </div>
      `).join('');
    }
    
    this.elements.modalOverlay.classList.add('modal-overlay--visible');
  }

  closeModal() {
    this.elements.modalOverlay.classList.remove('modal-overlay--visible');
  }

  getCurrentTimeMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  parseLaneId(lane) {
    const num = parseInt(lane, 10);
    return isNaN(num) ? lane : num;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const app = new PoolScheduleApp();
  app.init();
});

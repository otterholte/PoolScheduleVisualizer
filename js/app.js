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
    
    // Filter state: array of selected items
    // Each item: { type: 'activity'|'category', id: 'xxx', name: 'xxx', activityIds?: [...] }
    this.activeFilters = [];
    
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
      clearFilterBtn: document.getElementById('clearFilterBtn'),
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
      this.updateSliderRange();
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
    const categories = this.schedule.getActivityCategories();
    
    // Group activities by category and sort alphabetically within each
    this.categoryGroups = {};
    categories.forEach(cat => {
      this.categoryGroups[cat.id] = {
        name: cat.name,
        activities: activities
          .filter(a => a.category === cat.id)
          .sort((a, b) => a.name.localeCompare(b.name))
      };
    });
    
    // Render each category as an accordion card
    categories.forEach(cat => {
      const group = this.categoryGroups[cat.id];
      if (group.activities.length === 0) return;
      
      // Create category card
      const card = document.createElement('div');
      card.className = 'legend-category-card';
      card.dataset.category = cat.id;
      
      // Category header (clickable for category filter)
      const header = document.createElement('div');
      header.className = 'legend-category__header';
      header.innerHTML = `
        <span class="legend-category__title">${group.name}</span>
        <span class="legend-category__count">${group.activities.length}</span>
      `;
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCategoryFilter(cat.id);
      });
      card.appendChild(header);
      
      // Items container
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'legend-category__items';
      
      // Add activities in this category
      group.activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.dataset.activity = activity.id;
        item.dataset.category = cat.id;
        item.innerHTML = `
          <div class="legend-item__color" style="background: ${activity.color}"></div>
          <span class="legend-item__name">${activity.name}</span>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleActivityFilter(activity.id);
        });
        itemsContainer.appendChild(item);
      });
      
      card.appendChild(itemsContainer);
      container.appendChild(card);
    });
    
    // Set up clear filter button
    this.elements.clearFilterBtn.addEventListener('click', () => this.clearFilter());
  }

  toggleActivityFilter(activityId) {
    const existingIndex = this.activeFilters.findIndex(
      f => f.type === 'activity' && f.id === activityId
    );
    
    if (existingIndex !== -1) {
      // Remove if already selected
      this.activeFilters.splice(existingIndex, 1);
    } else {
      const activity = this.schedule.getActivity(activityId);
      this.activeFilters.push({ 
        type: 'activity', 
        id: activityId, 
        name: activity.name 
      });
    }
    
    this.updateFilterUI();
    this.updateLegendStates();
    this.updateDisplay();
  }

  toggleCategoryFilter(categoryId) {
    const existingIndex = this.activeFilters.findIndex(
      f => f.type === 'category' && f.id === categoryId
    );
    
    if (existingIndex !== -1) {
      // Remove if already selected
      this.activeFilters.splice(existingIndex, 1);
    } else {
      const category = this.categoryGroups[categoryId];
      this.activeFilters.push({ 
        type: 'category', 
        id: categoryId, 
        name: category.name,
        activityIds: category.activities.map(a => a.id)
      });
    }
    
    this.updateFilterUI();
    this.updateLegendStates();
    this.updateDisplay();
  }

  clearFilter() {
    this.activeFilters = [];
    this.updateFilterUI();
    this.updateLegendStates();
    this.updateDisplay();
  }

  updateFilterUI() {
    const filterValue = document.getElementById('filterValue');
    if (this.activeFilters.length > 0) {
      const names = this.activeFilters.map(f => f.name);
      if (names.length <= 2) {
        filterValue.textContent = 'Showing: ' + names.join(', ');
      } else {
        filterValue.textContent = `Showing: ${names.length} selections`;
      }
      this.elements.clearFilterBtn.classList.remove('legend-panel__clear-btn--hidden');
    } else {
      filterValue.textContent = '';
      this.elements.clearFilterBtn.classList.add('legend-panel__clear-btn--hidden');
    }
  }

  updateLegendStates() {
    const cards = this.elements.legendGrid.querySelectorAll('.legend-category-card');
    const items = this.elements.legendGrid.querySelectorAll('.legend-item');
    
    if (this.activeFilters.length === 0) {
      // No filter - reset all states
      cards.forEach(card => {
        card.classList.remove('legend-category-card--active', 'legend-category-card--dimmed');
      });
      items.forEach(item => {
        item.classList.remove('legend-item--active', 'legend-item--dimmed');
      });
      return;
    }
    
    // Get all selected category IDs and activity IDs
    const selectedCategoryIds = new Set(
      this.activeFilters.filter(f => f.type === 'category').map(f => f.id)
    );
    const selectedActivityIds = new Set(
      this.activeFilters.filter(f => f.type === 'activity').map(f => f.id)
    );
    
    // Update category cards
    cards.forEach(card => {
      const isSelected = selectedCategoryIds.has(card.dataset.category);
      card.classList.toggle('legend-category-card--active', isSelected);
      // Don't dim categories - only highlight selected ones
      card.classList.remove('legend-category-card--dimmed');
    });
    
    // Update activity items
    items.forEach(item => {
      const activityId = item.dataset.activity;
      const categoryId = item.dataset.category;
      
      // Check if this activity is directly selected or in a selected category
      const isDirectlySelected = selectedActivityIds.has(activityId);
      const isInSelectedCategory = selectedCategoryIds.has(categoryId);
      const isMatching = isDirectlySelected || isInSelectedCategory;
      
      item.classList.toggle('legend-item--active', isDirectlySelected);
      item.classList.toggle('legend-item--dimmed', !isMatching);
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
      this.highlightActiveDay();
      this.updateSliderRange();
      
      // Clamp current time to pool hours
      const hours = this.schedule.getPoolHours(this.selectedDate);
      let currentTime = this.getCurrentTimeMinutes();
      if (hours) {
        if (currentTime < hours.open) currentTime = hours.open;
        if (currentTime > hours.close) currentTime = hours.close;
      }
      this.selectedTimeMinutes = currentTime;
      
      this.updateTimeSlider();
      this.updateDisplay();
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
    this.updateSliderRange();
    this.updateDisplay();
  }

  updateSliderRange() {
    const hours = this.schedule.getPoolHours(this.selectedDate);
    if (!hours) return;
    
    const slider = this.elements.timeSlider;
    slider.min = hours.open;
    slider.max = hours.close;
    
    // Clamp current time to valid range
    if (this.selectedTimeMinutes < hours.open) {
      this.selectedTimeMinutes = hours.open;
    } else if (this.selectedTimeMinutes > hours.close) {
      this.selectedTimeMinutes = hours.close;
    }
    
    // Update hour marks
    this.updateHourMarks(hours.open, hours.close);
  }

  updateHourMarks(openMinutes, closeMinutes) {
    const marksContainer = document.querySelector('.time-slider-marks');
    if (!marksContainer) return;
    
    marksContainer.innerHTML = '';
    
    const totalRange = closeMinutes - openMinutes;
    
    // Generate marks at each hour
    const startHour = Math.ceil(openMinutes / 60);
    const endHour = Math.floor(closeMinutes / 60);
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const minutes = hour * 60;
      const position = ((minutes - openMinutes) / totalRange) * 100;
      
      // Format hour label
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      const label = `${displayHour}${period}`;
      
      const mark = document.createElement('span');
      mark.className = 'time-mark';
      mark.style.left = `${position}%`;
      mark.textContent = label;
      marksContainer.appendChild(mark);
    }
  }

  highlightActiveDay() {
    this.elements.daySelector.querySelectorAll('.day-tab').forEach(tab => {
      tab.classList.toggle('day-tab--active', tab.dataset.date === this.selectedDate);
    });
  }

  // Legacy method - redirects to new activity filter
  toggleFilter(activityId) {
    this.toggleActivityFilter(activityId);
  }

  // Check if an activity matches any of the active filters
  isActivityMatchingFilter(activityId) {
    if (this.activeFilters.length === 0) return true;
    
    for (const filter of this.activeFilters) {
      if (filter.type === 'activity' && filter.id === activityId) {
        return true;
      }
      if (filter.type === 'category' && filter.activityIds.includes(activityId)) {
        return true;
      }
    }
    return false;
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
    
    // Apply filter highlight
    if (this.activeFilters.length > 0) {
      if (this.isActivityMatchingFilter(activity.id)) {
        // Matching activity - show full color with glow
        laneEl.setAttribute('fill', activity.color);
        laneEl.style.filter = 'brightness(1.2) drop-shadow(0 0 8px ' + activity.color + ')';
      } else {
        // Non-matching activity - gray out completely
        laneEl.setAttribute('fill', '#4b5563');
        laneEl.style.opacity = '0.4';
      }
    } else {
      // No filter active - show normal activity color
      laneEl.setAttribute('fill', activity.color);
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

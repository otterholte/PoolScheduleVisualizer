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
      floorplanTitle: document.getElementById('floorplanTitle'),
      timeDisplay: document.getElementById('timeDisplay'),
      timeSlider: document.getElementById('timeSlider'),
      btnNow: document.getElementById('btnNow'),
      liveIndicator: document.getElementById('liveIndicator'),
      floorplan: document.getElementById('floorplan'),
      legendGrid: document.getElementById('legendGrid'),
      legendSidebar: document.querySelector('.legend-sidebar'),
      legendToggle: document.getElementById('legendToggle'),
      clearFilterBtn: document.getElementById('clearFilterBtn'),
      modalOverlay: document.getElementById('modalOverlay'),
      modalTitle: document.getElementById('modalTitle'),
      modalContent: document.getElementById('modalContent'),
      modalClose: document.getElementById('modalClose'),
      laneTooltip: document.getElementById('laneTooltip'),
      laneTooltipContent: document.getElementById('laneTooltipContent'),
      // Date navigation elements
      prevDay: document.getElementById('prevDay'),
      nextDay: document.getElementById('nextDay'),
      datePickerBtn: document.getElementById('datePickerBtn'),
      datePicker: document.getElementById('datePicker'),
      pickerMonth: document.getElementById('pickerMonth'),
      pickerDays: document.getElementById('pickerDays'),
      prevMonth: document.getElementById('prevMonth'),
      nextMonth: document.getElementById('nextMonth')
    };
    
    // Calendar picker state
    this.pickerMonth = new Date();
    this.datePickerOpen = false;
  }

  async init() {
    try {
      await this.schedule.load();
      
      this.setupClock();
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
    
    // Legend toggle
    this.elements.legendToggle.addEventListener('click', () => this.toggleLegend());
  }

  toggleLegend() {
    this.elements.legendSidebar.classList.toggle('legend-sidebar--hidden');
    this.elements.legendToggle.classList.toggle('legend-toggle--collapsed');
    // Expand floorplan to full height when legend is hidden
    document.querySelector('.floorplan-section').classList.toggle('floorplan-section--expanded');
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
        filterValue.textContent = names.join(', ');
      } else {
        filterValue.textContent = `${names.length} selected`;
      }
      this.elements.clearFilterBtn.classList.remove('legend-sidebar__clear-btn--hidden');
    } else {
      filterValue.textContent = '';
      this.elements.clearFilterBtn.classList.add('legend-sidebar__clear-btn--hidden');
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
    
    // Pool lane clicks and hover
    this.elements.floorplan.querySelectorAll('.pool-lane').forEach(lane => {
      lane.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideLaneTooltip(); // Hide tooltip on click
        const section = lane.closest('[data-section]')?.dataset.section || 
                       lane.closest('g[id$="-lanes"]')?.id.replace('-lanes', '');
        const laneId = lane.dataset.lane;
        if (section && laneId) {
          this.showLaneDetails(section, laneId);
        }
      });
      
      // Tooltip on hover
      lane.addEventListener('mouseenter', (e) => this.showLaneTooltip(e, lane));
      lane.addEventListener('mousemove', (e) => this.positionTooltip(e));
      lane.addEventListener('mouseleave', () => this.hideLaneTooltip());
    });
    
    // Date navigation - prev/next day
    this.elements.prevDay.addEventListener('click', () => this.navigateDay(-1));
    this.elements.nextDay.addEventListener('click', () => this.navigateDay(1));
    
    // Date picker toggle
    this.elements.datePickerBtn.addEventListener('click', () => this.toggleDatePicker());
    
    // Date picker month navigation
    this.elements.prevMonth.addEventListener('click', () => this.navigateMonth(-1));
    this.elements.nextMonth.addEventListener('click', () => this.navigateMonth(1));
    
    // Close date picker when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.elements.datePicker.contains(e.target) && 
          !this.elements.datePickerBtn.contains(e.target)) {
        this.closeDatePicker();
      }
    });
  }
  
  // Navigate day by offset (-1 for prev, +1 for next)
  navigateDay(offset) {
    const current = new Date(this.selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    this.selectDate(this.formatDate(current));
  }
  
  // Toggle date picker visibility
  toggleDatePicker() {
    if (this.datePickerOpen) {
      this.closeDatePicker();
    } else {
      this.openDatePicker();
    }
  }
  
  openDatePicker() {
    // Set picker month to selected date's month
    this.pickerMonth = new Date(this.selectedDate + 'T12:00:00');
    this.renderDatePicker();
    this.elements.datePicker.classList.add('date-picker--open');
    this.datePickerOpen = true;
  }
  
  closeDatePicker() {
    this.elements.datePicker.classList.remove('date-picker--open');
    this.datePickerOpen = false;
  }
  
  // Navigate month in date picker
  navigateMonth(offset) {
    this.pickerMonth.setMonth(this.pickerMonth.getMonth() + offset);
    this.renderDatePicker();
  }
  
  // Render the date picker calendar
  renderDatePicker() {
    const year = this.pickerMonth.getFullYear();
    const month = this.pickerMonth.getMonth();
    
    // Update month label
    const monthName = this.pickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    this.elements.pickerMonth.textContent = monthName;
    
    // Clear days
    this.elements.pickerDays.innerHTML = '';
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    // Get today's date string
    const todayStr = this.formatDate(new Date());
    
    // Fill in days from previous month
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonth.getDate() - i;
      const btn = this.createDayButton(new Date(year, month - 1, day), true);
      this.elements.pickerDays.appendChild(btn);
    }
    
    // Fill in current month days
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const btn = this.createDayButton(date, false);
      this.elements.pickerDays.appendChild(btn);
    }
    
    // Fill in days from next month
    const remainingSlots = 42 - this.elements.pickerDays.children.length;
    for (let day = 1; day <= remainingSlots; day++) {
      const btn = this.createDayButton(new Date(year, month + 1, day), true);
      this.elements.pickerDays.appendChild(btn);
    }
  }
  
  // Create a day button for the date picker
  createDayButton(date, isOtherMonth) {
    const dateStr = this.formatDate(date);
    const todayStr = this.formatDate(new Date());
    
    const btn = document.createElement('button');
    btn.className = 'date-picker__day';
    btn.textContent = date.getDate();
    
    if (isOtherMonth) btn.classList.add('date-picker__day--other-month');
    if (dateStr === todayStr) btn.classList.add('date-picker__day--today');
    if (dateStr === this.selectedDate) btn.classList.add('date-picker__day--selected');
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.selectDate(dateStr);
      // Directly remove the open class
      this.elements.datePicker.classList.remove('date-picker--open');
      this.datePickerOpen = false;
    });
    
    return btn;
  }

  selectDate(dateStr) {
    this.selectedDate = dateStr;
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
    const isLive = this.selectedTimeMinutes === this.getCurrentTimeMinutes() && 
                   this.selectedDate === this.formatDate(new Date());
    this.elements.timeDisplay.textContent = timeStr;
    
    // Update live indicator
    if (isLive) {
      this.elements.liveIndicator.classList.add('time-now-btn__live--active');
    } else {
      this.elements.liveIndicator.classList.remove('time-now-btn__live--active');
    }
    
    // Update title
    const date = new Date(this.selectedDate + 'T12:00:00');
    const dateDisplay = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    this.elements.floorplanTitle.textContent = dateDisplay;
    
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
      // Get current time and selected filters
      const currentTime = this.selectedTimeMinutes;
      const selectedActivityIds = this.getSelectedActivityIds();
      const hasFilters = selectedActivityIds.length > 0;
      
      this.elements.modalContent.innerHTML = laneSchedule.map(entry => {
        const startMinutes = this.schedule.timeToMinutes(entry.start);
        const endMinutes = this.schedule.timeToMinutes(entry.end);
        
        // Check if this is the current activity
        const isCurrent = currentTime >= startMinutes && currentTime < endMinutes;
        
        // Check if this matches selected filters
        const isSelected = hasFilters && selectedActivityIds.includes(entry.activity?.id);
        
        // Build CSS classes
        let itemClass = 'schedule-item';
        if (isCurrent) itemClass += ' schedule-item--current';
        if (isSelected) itemClass += ' schedule-item--selected';
        if (hasFilters && !isSelected) itemClass += ' schedule-item--dimmed';
        
        // Build badges
        let badges = '';
        if (isCurrent) badges += '<span class="schedule-item__badge schedule-item__badge--now">NOW</span>';
        if (isSelected) badges += '<span class="schedule-item__badge schedule-item__badge--match">MATCH</span>';
        
        return `
          <div class="${itemClass}">
            <div class="schedule-item__color" style="background: ${entry.activity.color}"></div>
            <span class="schedule-item__time">
              ${this.formatTimeAMPM(entry.start)} - ${this.formatTimeAMPM(entry.end)}
            </span>
            <span class="schedule-item__name">${entry.activity.name}</span>
            <div class="schedule-item__badges">${badges}</div>
          </div>
        `;
      }).join('');
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

  // Convert 24-hour time string to 12-hour AM/PM format
  formatTimeAMPM(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  // Tooltip methods
  showLaneTooltip(e, lane) {
    const section = lane.closest('[data-section]')?.dataset.section || 
                   lane.closest('g[id$="-lanes"]')?.id.replace('-lanes', '');
    const laneId = this.parseLaneId(lane.dataset.lane);
    
    // Get current status
    const status = this.schedule.getLaneStatus(this.selectedDate, section, laneId, this.selectedTimeMinutes);
    
    // Get all activities for this lane today
    const laneSchedule = this.schedule.getLaneSchedule(this.selectedDate, section, laneId);
    
    // Build tooltip content
    let html = '';
    
    if (this.activeFilters.length === 0) {
      // No filter - just show current activity
      if (status && status.activity) {
        html = `
          <div class="lane-tooltip__current">
            <div class="lane-tooltip__activity">
              <span class="lane-tooltip__activity-dot" style="background: ${status.activity.color}"></span>
              ${status.activity.name}
            </div>
            <div class="lane-tooltip__time">${this.formatTimeAMPM(status.entry.start)} - ${this.formatTimeAMPM(status.entry.end)}</div>
          </div>
        `;
      } else {
        html = `<div class="lane-tooltip__no-match">No activity scheduled</div>`;
      }
    } else {
      // Filter active - show current (if matching) + other matching times
      const selectedActivityIds = this.getSelectedActivityIds();
      
      // Current activity
      if (status && status.activity) {
        const isMatch = selectedActivityIds.includes(status.activity.id);
        if (isMatch) {
          html = `
            <div class="lane-tooltip__current">
              <div class="lane-tooltip__activity">
                <span class="lane-tooltip__activity-dot" style="background: ${status.activity.color}"></span>
                ${status.activity.name}
              </div>
              <div class="lane-tooltip__time">${this.formatTimeAMPM(status.entry.start)} - ${this.formatTimeAMPM(status.entry.end)}</div>
            </div>
          `;
        } else {
          html = `
            <div class="lane-tooltip__current">
              <div class="lane-tooltip__no-match">Current: ${status.activity.name} (not selected)</div>
            </div>
          `;
        }
      } else {
        html = `
          <div class="lane-tooltip__current">
            <div class="lane-tooltip__no-match">No activity at current time</div>
          </div>
        `;
      }
      
      // Find other matching times today
      const matchingSlots = laneSchedule.filter(slot => 
        selectedActivityIds.includes(slot.activity?.id) && 
        !(status && slot.start === status.entry?.start && slot.end === status.entry?.end)
      );
      
      if (matchingSlots.length > 0) {
        html += `<div class="lane-tooltip__other-times"><strong>Other times today:</strong>`;
        html += `<div class="lane-tooltip__match">`;
        matchingSlots.forEach(slot => {
          html += `
            <div class="lane-tooltip__match-item">
              <span class="lane-tooltip__match-dot" style="background: ${slot.activity?.color || '#666'}"></span>
              ${this.formatTimeAMPM(slot.start)} - ${this.formatTimeAMPM(slot.end)}
            </div>
          `;
        });
        html += `</div></div>`;
      } else if (!status || !selectedActivityIds.includes(status.activity?.id)) {
        html += `<div class="lane-tooltip__no-match">No selected activities in this lane today</div>`;
      }
    }
    
    this.elements.laneTooltipContent.innerHTML = html;
    this.elements.laneTooltip.classList.add('lane-tooltip--visible');
    this.positionTooltip(e);
  }
  
  positionTooltip(e) {
    const tooltip = this.elements.laneTooltip;
    const padding = 12;
    
    let x = e.clientX + padding;
    let y = e.clientY + padding;
    
    // Keep tooltip on screen
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      x = e.clientX - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight) {
      y = e.clientY - rect.height - padding;
    }
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  
  hideLaneTooltip() {
    this.elements.laneTooltip.classList.remove('lane-tooltip--visible');
  }
  
  getSelectedActivityIds() {
    const ids = [];
    this.activeFilters.forEach(filter => {
      if (filter.type === 'activity') {
        ids.push(filter.id);
      } else if (filter.type === 'category' && filter.activityIds) {
        ids.push(...filter.activityIds);
      }
    });
    return ids;
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

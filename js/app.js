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
      floorplanTitle: document.getElementById('floorplanTitle'),
      timeDisplay: document.getElementById('timeDisplay'),
      timeSlider: document.getElementById('timeSlider'),
      btnNow: document.getElementById('btnNow'),
      liveIndicator: document.getElementById('liveIndicator'),
      closedIndicator: document.getElementById('closedIndicator'),
      poolClosedOverlay: document.getElementById('poolClosedOverlay'),
      closeOverlayBtn: document.getElementById('closeOverlayBtn'),
      nextOpenTime: document.getElementById('nextOpenTime'),
      floorplanWrapper: document.querySelector('.floorplan-wrapper'),
      floorplan: document.getElementById('floorplan'),
      legendGrid: document.getElementById('legendGrid'),
      legendSidebar: document.querySelector('.legend-sidebar'),
      legendToggle: document.getElementById('legendToggle'),
      clearFilterBtn: document.getElementById('clearFilterBtn'),
      modalOverlay: document.getElementById('modalOverlay'),
      modalTitle: document.getElementById('modalTitle'),
      modalSubtitle: document.getElementById('modalSubtitle'),
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
      nextMonth: document.getElementById('nextMonth'),
      // Quick filter buttons
      quickFilterOpenSwim: document.getElementById('quickFilterOpenSwim'),
      quickFilterShowAll: document.getElementById('quickFilterShowAll'),
      // List view element
      listView: document.getElementById('listView')
    };
    
    // Calendar picker state
    this.pickerMonth = new Date();
    this.datePickerOpen = false;
    
    // Track if Open Swim quick filter mode is active (hides other categories)
    this.openSwimQuickMode = false;
    
    // Track if user dismissed the closed overlay for today
    this.closedOverlayDismissed = false;
    
    // Current view mode: 'map' or 'list'
    this.currentView = 'map';
  }

  async init() {
    try {
      await this.schedule.load();
      
      this.setupClock();
      this.renderLegend();
      this.setupEventListeners();
      this.updateSliderRange();
      this.updateTimeSlider();
      
      // Load state from URL parameters (overrides defaults)
      const urlState = this.loadStateFromURL();
      
      if (urlState.filter) {
        // Apply filter from URL
        if (urlState.filter === 'open_swim') {
          this.selectOpenSwimFilter();
        } else if (urlState.filter === 'all') {
          this.clearAllFilters();
        }
      } else {
        // Check if first visit - default to Open Swim
        this.applyDefaultFilter();
      }
      
      this.updateDisplay();
      
      // Apply view from URL (after rendering is ready)
      if (urlState.view && urlState.view !== 'map') {
        this.switchView(urlState.view);
      }
      
      // Listen for browser back/forward navigation
      window.addEventListener('popstate', () => this.handlePopState());
      
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  }
  
  /**
   * Load state from URL parameters
   */
  loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    return {
      view: params.get('view'),
      filter: params.get('filter')
    };
  }
  
  /**
   * Update URL with current state (without reloading)
   */
  updateURL() {
    const params = new URLSearchParams();
    
    // Add view parameter (only if not map, since map is default)
    if (this.currentView !== 'map') {
      params.set('view', this.currentView);
    }
    
    // Add filter parameter
    if (this.openSwimQuickMode) {
      params.set('filter', 'open_swim');
    } else if (this.activeFilters.length === 0) {
      params.set('filter', 'all');
    }
    // Note: Individual activity/category selections are not persisted to URL
    // to keep the URL simple. Only 'open_swim' and 'all' are URL-friendly.
    
    const newURL = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    window.history.pushState({}, '', newURL);
  }
  
  /**
   * Handle browser back/forward navigation
   */
  handlePopState() {
    const urlState = this.loadStateFromURL();
    
    // Apply view
    const view = urlState.view || 'map';
    if (view !== this.currentView) {
      this.switchView(view);
    }
    
    // Apply filter
    if (urlState.filter === 'open_swim' && !this.openSwimQuickMode) {
      this.selectOpenSwimFilter();
    } else if (urlState.filter === 'all' && (this.activeFilters.length > 0 || this.openSwimQuickMode)) {
      this.clearAllFilters();
    }
  }
  
  applyDefaultFilter() {
    const hasVisited = localStorage.getItem('poolSchedule_hasVisited');
    
    if (!hasVisited) {
      // First visit - default to Open Swim category
      localStorage.setItem('poolSchedule_hasVisited', 'true');
      this.selectOpenSwimFilter();
    }
    
    this.updateQuickFilterButtons();
  }
  
  selectOpenSwimFilter() {
    // Find the Open Swim category
    const categories = this.schedule.getCategories();
    const openSwimCategory = categories.find(cat => cat.id === 'open');
    
    if (openSwimCategory) {
      // Get all activity IDs in the Open Swim category
      const activityIds = this.schedule.getActivitiesByCategory(openSwimCategory.id)
        .map(a => a.id);
      
      // Clear existing filters and add Open Swim category
      this.activeFilters = [{
        type: 'category',
        id: openSwimCategory.id,
        name: openSwimCategory.name,
        activityIds: activityIds
      }];
      
      // Enable quick mode to hide other categories
      this.openSwimQuickMode = true;
      
      // Update legend visuals
      this.updateFilterUI();
      this.updateLegendStates();
      this.updateQuickFilterButtons();
      
      // Update URL
      this.updateURL();
    }
  }
  
  clearAllFilters() {
    this.activeFilters = [];
    this.openSwimQuickMode = false;
    this.updateFilterUI();
    this.updateLegendStates();
    this.updateQuickFilterButtons();
    this.updatePoolLanes();
    
    // Update URL
    this.updateURL();
  }
  
  updateQuickFilterButtons() {
    // Only show Open Swim as active if in quick mode (clicked the toggle button)
    const isOpenSwimQuickActive = this.openSwimQuickMode;
    // Show All as active when no filters OR when manually selecting from legend (not in quick mode)
    const isAllActive = this.activeFilters.length === 0 || !this.openSwimQuickMode;
    
    this.elements.quickFilterOpenSwim.classList.toggle('quick-view-toggle__btn--active', isOpenSwimQuickActive);
    this.elements.quickFilterShowAll.classList.toggle('quick-view-toggle__btn--active', isAllActive && !isOpenSwimQuickActive);
  }

  setupClock() {
    // Track last known minute to detect changes
    let lastMinute = new Date().getMinutes();
    
    const checkTimeUpdate = () => {
      const now = new Date();
      const currentMinute = now.getMinutes();
      
      // Check if minute has changed
      if (currentMinute !== lastMinute) {
        lastMinute = currentMinute;
        
        // Check if we're viewing today and at live time
        const today = this.formatDate(now);
        const currentTimeMinutes = this.getCurrentTimeMinutes();
        const isViewingToday = this.selectedDate === today;
        const isAtLiveTime = this.selectedTimeMinutes === this.getCurrentTimeMinutes() - 1 || 
                            this.selectedTimeMinutes === currentTimeMinutes;
        
        if (isViewingToday && isAtLiveTime) {
          // Update to current time and refresh display
          this.selectedTimeMinutes = currentTimeMinutes;
          this.updateTimeSlider();
          this.updateDisplay();
        }
      }
    };
    
    // Check every 10 seconds for minute changes
    setInterval(checkTimeUpdate, 10000);
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
    // Disable quick mode when manually selecting from legend
    this.openSwimQuickMode = false;
    
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
    // Disable quick mode when manually selecting from legend
    this.openSwimQuickMode = false;
    
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
    this.openSwimQuickMode = false;
    this.updateFilterUI();
    this.updateLegendStates();
    this.updateDisplay();
    
    // Update URL
    this.updateURL();
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
    
    // Update quick filter button states
    this.updateQuickFilterButtons();
  }

  updateLegendStates() {
    const cards = this.elements.legendGrid.querySelectorAll('.legend-category-card');
    const items = this.elements.legendGrid.querySelectorAll('.legend-item');
    
    if (this.activeFilters.length === 0) {
      // No filter - reset all states and show all
      cards.forEach(card => {
        card.classList.remove('legend-category-card--active', 'legend-category-card--dimmed', 'legend-category-card--hidden');
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
      // Hide non-selected categories only when in quick mode (from toggle button)
      card.classList.toggle('legend-category-card--hidden', this.openSwimQuickMode && !isSelected);
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
    
    // Quick filter buttons
    this.elements.quickFilterOpenSwim.addEventListener('click', () => {
      this.selectOpenSwimFilter();
      this.updatePoolLanes();
    });
    
    this.elements.quickFilterShowAll.addEventListener('click', () => {
      this.clearAllFilters();
    });
    
    // Close overlay button
    this.elements.closeOverlayBtn.addEventListener('click', () => {
      this.closedOverlayDismissed = true;
      this.elements.poolClosedOverlay.classList.remove('pool-closed-overlay--visible');
      this.elements.floorplanWrapper.classList.remove('floorplan-wrapper--closed');
    });
    
    // View toggle (Map/Grid)
    this.setupViewToggle();
  }
  
  setupViewToggle() {
    const viewToggle = document.getElementById('viewToggle');
    if (!viewToggle) return;
    
    const buttons = viewToggle.querySelectorAll('.view-toggle__btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
      });
    });
  }
  
  switchView(view) {
    if (this.currentView === view) return;
    
    this.currentView = view;
    
    // Update toggle button states
    const buttons = document.querySelectorAll('.view-toggle__btn');
    buttons.forEach(btn => {
      btn.classList.toggle('view-toggle__btn--active', btn.dataset.view === view);
    });
    
    // Get the main content containers
    const mapView = document.querySelector('.main-content');
    const listView = document.getElementById('listView');
    
    if (view === 'map') {
      if (mapView) mapView.style.display = '';
      if (listView) listView.style.display = 'none';
      // Update map display when switching back
      this.updateDisplay();
    } else if (view === 'list') {
      if (mapView) mapView.style.display = 'none';
      if (listView) listView.style.display = 'flex';
      // List view will be implemented later
    }
    
    // Update URL with new view
    this.updateURL();
  }
  
  // Navigate day by offset (-1 for prev, +1 for next)
  navigateDay(offset) {
    const today = this.formatDate(new Date());
    const isCurrentlyOnToday = this.selectedDate === today;
    const currentRealTimeMinutes = this.getCurrentTimeMinutes();
    const poolHours = this.schedule.getPoolHours(this.selectedDate);
    const isAfterClosing = poolHours && currentRealTimeMinutes >= poolHours.close;
    
    // Navigate to new date
    const current = new Date(this.selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    const newDate = this.formatDate(current);
    
    // Special case: Going from today (after closing) to tomorrow
    // Set scrubber to opening time instead of keeping it at closing time
    if (isCurrentlyOnToday && isAfterClosing && offset === 1) {
      const tomorrowHours = this.schedule.getPoolHours(newDate);
      if (tomorrowHours) {
        this.selectedTimeMinutes = tomorrowHours.open;
      }
    }
    
    this.selectDate(newDate);
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
    
    const today = this.formatDate(new Date());
    const isViewingToday = this.selectedDate === today;
    const currentRealTimeMinutes = this.getCurrentTimeMinutes();
    
    // If viewing today and it's after closing, set slider to closing time
    if (isViewingToday && currentRealTimeMinutes >= hours.close) {
      this.selectedTimeMinutes = hours.close;
    }
    // Clamp to valid range
    else if (this.selectedTimeMinutes < hours.open) {
      this.selectedTimeMinutes = hours.open;
    } else if (this.selectedTimeMinutes > hours.close) {
      this.selectedTimeMinutes = hours.close;
    }
    
    slider.value = this.selectedTimeMinutes;
    
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
    const today = this.formatDate(new Date());
    const isViewingToday = this.selectedDate === today;
    const currentRealTimeMinutes = this.getCurrentTimeMinutes();
    const poolHours = this.schedule.getPoolHours(this.selectedDate);
    
    // Check if pool is CURRENTLY closed (real time check for today only)
    const isCurrentlyClosed = isViewingToday && poolHours && (
      currentRealTimeMinutes < poolHours.open || 
      currentRealTimeMinutes >= poolHours.close
    );
    
    // Reset dismissed flag when navigating away from today
    if (!isViewingToday) {
      this.closedOverlayDismissed = false;
    }
    
    // Update time display - show current real time if after closing on today
    let displayTimeMinutes = this.selectedTimeMinutes;
    if (isViewingToday && poolHours && currentRealTimeMinutes >= poolHours.close) {
      // After closing - show actual current time in badge
      displayTimeMinutes = currentRealTimeMinutes;
    }
    const timeStr = this.schedule.minutesToTimeString(displayTimeMinutes);
    this.elements.timeDisplay.textContent = timeStr;
    
    // Determine if we should show the LIVE badge
    const isLive = this.selectedTimeMinutes === currentRealTimeMinutes && 
                   isViewingToday && !isCurrentlyClosed;
    
    // Update live/closed indicators and overlay
    if (isCurrentlyClosed) {
      // Pool is currently closed (today, after hours)
      this.elements.liveIndicator.classList.remove('time-now-btn__live--active');
      this.elements.closedIndicator.classList.add('time-now-btn__closed--active');
      
      // Show overlay only if not dismissed
      if (!this.closedOverlayDismissed) {
        this.elements.poolClosedOverlay.classList.add('pool-closed-overlay--visible');
        this.elements.floorplanWrapper.classList.add('floorplan-wrapper--closed');
      }
      
      // Calculate next open time
      this.updateNextOpenTime(poolHours, currentRealTimeMinutes);
    } else {
      // Pool is open or viewing a different day
      this.elements.closedIndicator.classList.remove('time-now-btn__closed--active');
      this.elements.poolClosedOverlay.classList.remove('pool-closed-overlay--visible');
      this.elements.floorplanWrapper.classList.remove('floorplan-wrapper--closed');
      
      // Update live indicator
      if (isLive) {
        this.elements.liveIndicator.classList.add('time-now-btn__live--active');
      } else {
        this.elements.liveIndicator.classList.remove('time-now-btn__live--active');
      }
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
  
  updateNextOpenTime(poolHours, currentTimeMinutes) {
    if (!poolHours) return;
    
    // Check if we're before opening or after closing
    if (currentTimeMinutes < poolHours.open) {
      // Before opening today - use today's hours
      const formattedOpenTime = this.schedule.minutesToTimeString(poolHours.open);
      this.elements.nextOpenTime.textContent = `Opens today at ${formattedOpenTime}`;
    } else {
      // After closing - check TOMORROW's schedule for accurate open time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = this.formatDate(tomorrow);
      const tomorrowHours = this.schedule.getPoolHours(tomorrowDate);
      
      if (tomorrowHours) {
        const formattedOpenTime = this.schedule.minutesToTimeString(tomorrowHours.open);
        this.elements.nextOpenTime.textContent = `Opens tomorrow at ${formattedOpenTime}`;
      } else {
        this.elements.nextOpenTime.textContent = `Check schedule for next open day`;
      }
    }
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
    // Use consistent grey for all inactive/closed/non-matching states
    const INACTIVE_GREY = '#434c5c';
    
    // Reset styles
    laneEl.style.opacity = '1';
    laneEl.style.filter = '';
    laneEl.setAttribute('fill-opacity', '1'); // Ensure fill is visible (covers background)
    
    if (!status) {
      // No activity - closed/unavailable
      laneEl.setAttribute('fill', INACTIVE_GREY);
      return;
    }
    
    const activity = status.activity;
    
    // Apply filter highlight
    if (this.activeFilters.length > 0) {
      if (this.isActivityMatchingFilter(activity.id)) {
        // Matching activity - show full color with subtle glow
        laneEl.setAttribute('fill', activity.color);
        laneEl.style.filter = 'brightness(1.05) drop-shadow(0 0 4px ' + activity.color + ')';
      } else {
        // Non-matching activity - same grey as closed/unavailable
        laneEl.setAttribute('fill', INACTIVE_GREY);
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
    
    // Set subtitle with viewing date and time
    const viewingDate = new Date(this.selectedDate + 'T12:00:00');
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const formattedDate = viewingDate.toLocaleDateString('en-US', dateOptions);
    const formattedTime = this.schedule.minutesToTimeString(this.selectedTimeMinutes);
    this.elements.modalSubtitle.textContent = `Viewing: ${formattedDate} at ${formattedTime}`;
    
    if (laneSchedule.length === 0) {
      this.elements.modalContent.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          No scheduled activities for this lane today.
        </div>
      `;
    } else {
      // Get scrubber time and actual current time
      const scrubberTime = this.selectedTimeMinutes;
      const actualCurrentTime = this.getCurrentTimeMinutes();
      const isViewingToday = this.selectedDate === this.formatDate(new Date());
      const isLiveNow = isViewingToday && scrubberTime === actualCurrentTime;
      const selectedActivityIds = this.getSelectedActivityIds();
      const hasFilters = selectedActivityIds.length > 0;
      
      // Track if we need to add separator
      let addedSeparator = false;
      
      // Check if any event is currently active at scrubber time (for end-of-day edge case)
      const hasActiveEvent = laneSchedule.some(e => {
        const start = this.schedule.timeToMinutes(e.start);
        const end = this.schedule.timeToMinutes(e.end);
        return scrubberTime >= start && scrubberTime < end;
      });
      
      this.elements.modalContent.innerHTML = laneSchedule.map((entry, index) => {
        const startMinutes = this.schedule.timeToMinutes(entry.start);
        const endMinutes = this.schedule.timeToMinutes(entry.end);
        
        // Check timing relative to scrubber position (for NOW/SELECTED badge)
        // Include events that end exactly at scrubber time if no other event is active
        const isAtScrubber = (scrubberTime >= startMinutes && scrubberTime < endMinutes) ||
                            (!hasActiveEvent && scrubberTime === endMinutes);
        
        // Check timing relative to actual current time (for past/future styling)
        // Only apply real-time past styling when viewing today
        const isPast = isViewingToday && endMinutes <= actualCurrentTime;
        const isFuture = !isViewingToday || startMinutes > actualCurrentTime;
        const isCurrent = isAtScrubber;
        
        // Check if this matches selected filters
        const matchesFilter = selectedActivityIds.includes(entry.activity?.id);
        // Show match for current or future activities that match
        const showMatch = hasFilters && matchesFilter && !isPast;
        
        // Build CSS classes
        let itemClass = 'schedule-item';
        if (isCurrent) itemClass += ' schedule-item--current';
        if (showMatch && !isCurrent) itemClass += ' schedule-item--selected';
        if (isPast) itemClass += ' schedule-item--past';
        // Only dim future non-matches when filters are active
        if (hasFilters && !matchesFilter && !isPast) itemClass += ' schedule-item--dimmed';
        
        // Build badges - NOW only for live current time, SELECTED for other times
        let badges = '';
        if (isCurrent) {
          if (isLiveNow) {
            badges += '<span class="schedule-item__badge schedule-item__badge--now">NOW</span>';
          } else {
            badges += '<span class="schedule-item__badge schedule-item__badge--selected">SELECTED</span>';
          }
        }
        if (showMatch) badges += '<span class="schedule-item__badge schedule-item__badge--match">MATCH</span>';
        
        // Add separator before first non-past item when viewing today
        let separator = '';
        if (isViewingToday && !addedSeparator && !isPast) {
          // Check if there were any past items
          const hasPastItems = laneSchedule.some(e => {
            const end = this.schedule.timeToMinutes(e.end);
            return end <= actualCurrentTime;
          });
          if (hasPastItems) {
            separator = '<div class="schedule-separator"><span>Earlier Today</span></div>';
          }
          addedSeparator = true;
        }
        
        return `
          ${separator}
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

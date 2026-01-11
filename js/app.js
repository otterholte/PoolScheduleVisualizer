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
      // Grid view elements
      gridView: document.getElementById('gridView'),
      scheduleGrid: document.getElementById('scheduleGrid'),
      scheduleGridContainer: document.getElementById('scheduleGridContainer'),
      gridDateTitle: document.getElementById('gridDateTitle'),
      gridTimeDisplay: document.getElementById('gridTimeDisplay'),
      gridBtnNow: document.getElementById('gridBtnNow'),
      gridLiveIndicator: document.getElementById('gridLiveIndicator'),
      gridPrevDay: document.getElementById('gridPrevDay'),
      gridNextDay: document.getElementById('gridNextDay'),
      gridDatePickerBtn: document.getElementById('gridDatePickerBtn'),
      gridDatePicker: document.getElementById('gridDatePicker'),
      gridPickerMonth: document.getElementById('gridPickerMonth'),
      gridPickerDays: document.getElementById('gridPickerDays'),
      gridPrevMonth: document.getElementById('gridPrevMonth'),
      gridNextMonth: document.getElementById('gridNextMonth'),
      gridLegendToggle: document.getElementById('gridLegendToggle'),
      gridLegendSidebar: document.getElementById('gridLegendSidebar'),
      gridLegendGrid: document.getElementById('gridLegendGrid'),
      gridClearFilterBtn: document.getElementById('gridClearFilterBtn'),
      gridQuickFilterOpenSwim: document.getElementById('gridQuickFilterOpenSwim'),
      gridQuickFilterShowAll: document.getElementById('gridQuickFilterShowAll')
    };
    
    // Grid view state
    this.gridDatePickerOpen = false;
    
    // Calendar picker state
    this.pickerMonth = new Date();
    this.datePickerOpen = false;
    
    // Track if Open Swim quick filter mode is active (hides other categories)
    this.openSwimQuickMode = false;
    
    // Track if user dismissed the closed overlay for today
    this.closedOverlayDismissed = false;
    
    // Current view mode: 'map' or 'grid'
    this.currentView = 'map';
  }

  async init() {
    try {
      await this.schedule.load();
      
      this.setupClock();
      this.renderLegend();
      this.setupEventListeners();
      this.setupGridEventListeners();
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
      
      // Pre-render grid legend (will be shown when switching to grid view)
      this.renderGridLegend();
      
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
      
      // Also update grid view if active
      if (this.currentView === 'grid') {
        this.renderGridView();
        this.updateGridLegendStates();
        this.updateGridFilterUI();
      }
      
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
    
    // Also update grid view if active
    if (this.currentView === 'grid') {
      this.renderGridView();
      this.updateGridLegendStates();
      this.updateGridFilterUI();
    }
    
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
    
    // Also update grid view if active
    if (this.currentView === 'grid') {
      this.renderGridView();
      this.updateGridLegendStates();
      this.updateGridFilterUI();
    }
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
    
    // Also update grid view if active
    if (this.currentView === 'grid') {
      this.renderGridView();
      this.updateGridLegendStates();
      this.updateGridFilterUI();
    }
  }

  clearFilter() {
    this.activeFilters = [];
    this.openSwimQuickMode = false;
    this.updateFilterUI();
    this.updateLegendStates();
    this.updateDisplay();
    
    // Also update grid view if active
    if (this.currentView === 'grid') {
      this.renderGridView();
      this.updateGridLegendStates();
      this.updateGridFilterUI();
    }
    
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
    const gridView = document.getElementById('gridView');
    
    if (view === 'map') {
      if (mapView) mapView.style.display = '';
      if (gridView) gridView.style.display = 'none';
      // Update map display when switching back
      this.updateDisplay();
    } else if (view === 'grid') {
      if (mapView) mapView.style.display = 'none';
      if (gridView) gridView.style.display = 'flex';
      // Render grid view
      this.renderGridView();
      this.updateGridLegendStates();
      this.updateGridFilterUI();
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
    
    // Also update grid view if active
    if (this.currentView === 'grid') {
      this.renderGridView();
    }
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

  // ==========================================
  // Grid View Methods
  // ==========================================
  
  /**
   * Render the full day grid schedule
   */
  renderGridView() {
    const table = this.elements.scheduleGrid;
    if (!table) return;
    
    // Get pool hours for the selected date
    const hours = this.schedule.getPoolHours(this.selectedDate);
    if (!hours) {
      table.innerHTML = '<tr><td style="padding: 40px; text-align: center; color: var(--text-muted);">No schedule data available for this date.</td></tr>';
      return;
    }
    
    // Get sections from pool layout
    const layout = this.schedule.getPoolLayout();
    const sections = layout?.sections || [];
    
    // Generate time slots (30-minute increments)
    const timeSlots = this.generateTimeSlots(hours.open, hours.close, 30);
    
    // Get current time for highlighting
    const today = this.formatDate(new Date());
    const isViewingToday = this.selectedDate === today;
    const currentTimeMinutes = this.getCurrentTimeMinutes();
    
    // Build the table HTML
    let html = '';
    
    // Header Row 1: Pool Section Names
    html += '<thead>';
    html += '<tr>';
    html += '<th class="schedule-grid__section-header" rowspan="2">Time</th>';
    
    sections.forEach(section => {
      const sectionClass = this.getSectionHeaderClass(section.id);
      html += `<th class="schedule-grid__section-header ${sectionClass}" colspan="${section.lanes.length}">${section.name}</th>`;
    });
    html += '</tr>';
    
    // Header Row 2: Lane Numbers
    html += '<tr>';
    sections.forEach((section, sectionIndex) => {
      section.lanes.forEach((lane, laneIndex) => {
        const isLastLane = laneIndex === section.lanes.length - 1;
        let laneClass = 'schedule-grid__lane-header';
        if (isLastLane) laneClass += ' schedule-grid__lane-header--section-end';
        html += `<th class="${laneClass}">${lane}</th>`;
      });
    });
    html += '</tr>';
    html += '</thead>';
    
    // Body Rows: Time slots
    html += '<tbody>';
    timeSlots.forEach((slot, rowIndex) => {
      const isCurrentRow = isViewingToday && 
        currentTimeMinutes >= slot.minutes && 
        currentTimeMinutes < slot.minutes + 30;
      
      const rowClass = isCurrentRow ? 'schedule-grid__row--current' : '';
      html += `<tr class="${rowClass}" data-time="${slot.minutes}">`;
      
      // Time column
      html += `<td class="schedule-grid__time">${slot.label}</td>`;
      
      // Lane cells
      sections.forEach(section => {
        section.lanes.forEach((lane, laneIndex) => {
          const laneId = this.parseLaneId(lane);
          const status = this.schedule.getLaneStatus(this.selectedDate, section.id, laneId, slot.minutes);
          const isLastLane = laneIndex === section.lanes.length - 1;
          
          let cellClass = 'schedule-grid__cell';
          if (isLastLane) cellClass += ' schedule-grid__cell--section-end';
          let cellStyle = '';
          let cellContent = '';
          let cellTitle = '';
          
          if (status && status.activity) {
            const activity = status.activity;
            const isMatch = this.isActivityMatchingFilter(activity.id);
            
            cellClass += ' schedule-grid__cell--activity';
            if (this.activeFilters.length > 0 && !isMatch) {
              cellClass += ' schedule-grid__cell--dimmed';
            }
            
            cellStyle = `background-color: ${activity.color};`;
            cellTitle = ''; // Use custom tooltip instead
            
            // Show start time ONLY if it doesn't align with 30-minute grid intervals
            // (i.e., only show if starts at :15 or :45)
            const activityStart = this.schedule.timeToMinutes(status.entry.start);
            const startsOffGrid = (activityStart % 30) !== 0;
            
            // Show time label ONLY if activity starts off-grid (:15 or :45)
            // When time is on-grid (:00 or :30), don't show - it's obvious from the row
            if (startsOffGrid && slot.minutes <= activityStart && slot.minutes + 30 > activityStart) {
              cellContent = `<span class="schedule-grid__start-time">${this.formatTimeCompact(status.entry.start)}</span>`;
            }
          } else {
            cellClass += ' schedule-grid__cell--closed';
            cellTitle = ''; // Use custom tooltip instead
          }
          
          html += `<td class="${cellClass}" style="${cellStyle}" title="${cellTitle}" data-section="${section.id}" data-lane="${lane}" data-time="${slot.minutes}">${cellContent}</td>`;
        });
      });
      
      html += '</tr>';
    });
    html += '</tbody>';
    
    table.innerHTML = html;
    
    // Add click handlers to cells
    this.setupGridCellHandlers();
    
    // Scroll to current time if viewing today
    if (isViewingToday) {
      this.scrollToCurrentTime();
    }
    
    // Update grid header displays
    this.updateGridHeader();
  }
  
  /**
   * Generate time slots for the grid
   */
  generateTimeSlots(startMinutes, endMinutes, intervalMinutes) {
    const slots = [];
    for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
      slots.push({
        minutes: minutes,
        label: this.schedule.minutesToTimeString(minutes)
      });
    }
    return slots;
  }
  
  /**
   * Get CSS class for section header based on section ID
   */
  getSectionHeaderClass(sectionId) {
    const classMap = {
      'therapy': 'schedule-grid__section-header--therapy',
      'instructional': 'schedule-grid__section-header--instructional',
      'shallow': 'schedule-grid__section-header--shallow',
      'main': 'schedule-grid__section-header--main',
      'deep': 'schedule-grid__section-header--deep',
      'deep_south': 'schedule-grid__section-header--deep-well',
      'deep_north': 'schedule-grid__section-header--deep-well'
    };
    return classMap[sectionId] || '';
  }
  
  /**
   * Format time in compact format (e.g., "6:30")
   */
  formatTimeCompact(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const hour12 = hours % 12 || 12;
    return minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, '0')}`;
  }
  
  /**
   * Setup click handlers for grid cells
   */
  setupGridCellHandlers() {
    const cells = this.elements.scheduleGrid.querySelectorAll('.schedule-grid__cell--activity');
    cells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        const section = cell.dataset.section;
        const lane = cell.dataset.lane;
        const timeMinutes = parseInt(cell.dataset.time, 10);
        
        // Temporarily set selected time to this cell's time for modal
        const originalTime = this.selectedTimeMinutes;
        this.selectedTimeMinutes = timeMinutes;
        
        this.showLaneDetails(section, lane);
        
        // Restore original time
        this.selectedTimeMinutes = originalTime;
      });
    });
    
    // Add row hover highlighting for all rows
    const rows = this.elements.scheduleGrid.querySelectorAll('tbody tr');
    rows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        row.classList.add('schedule-grid__row--hover');
      });
      row.addEventListener('mouseleave', () => {
        row.classList.remove('schedule-grid__row--hover');
      });
    });
    
    // Add tooltip handlers for all cells
    const allCells = this.elements.scheduleGrid.querySelectorAll('.schedule-grid__cell');
    allCells.forEach(cell => {
      cell.addEventListener('mouseenter', (e) => this.startGridCellTooltip(e, cell));
      cell.addEventListener('mousemove', (e) => {
        if (this.elements.laneTooltip.classList.contains('lane-tooltip--visible')) {
          this.positionTooltip(e);
        }
        this.lastTooltipEvent = e; // Store for delayed show
      });
      cell.addEventListener('mouseleave', () => this.cancelGridCellTooltip());
    });
  }
  
  /**
   * Start tooltip timer for grid cell (delays showing)
   */
  startGridCellTooltip(e, cell) {
    this.lastTooltipEvent = e;
    this.pendingTooltipCell = cell;
    
    // Clear any existing timer
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
    }
    
    // Delay tooltip by 500ms (similar to native tooltips)
    this.tooltipTimer = setTimeout(() => {
      if (this.pendingTooltipCell === cell) {
        this.showGridCellTooltip(this.lastTooltipEvent, cell);
      }
    }, 500);
  }
  
  /**
   * Cancel pending tooltip
   */
  cancelGridCellTooltip() {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    this.pendingTooltipCell = null;
    this.hideLaneTooltip();
  }
  
  /**
   * Show custom tooltip for grid cell
   */
  showGridCellTooltip(e, cell) {
    const sectionId = cell.dataset.section;
    const lane = cell.dataset.lane;
    const timeMinutes = parseInt(cell.dataset.time, 10);
    
    // Get section info
    const layout = this.schedule.getPoolLayout();
    const section = layout?.sections?.find(s => s.id === sectionId);
    const sectionName = section?.name || sectionId;
    
    // Get activity status
    const laneId = this.parseLaneId(lane);
    const status = this.schedule.getLaneStatus(this.selectedDate, sectionId, laneId, timeMinutes);
    
    let html = '';
    
    if (status && status.activity) {
      const activity = status.activity;
      html = `
        <div class="lane-tooltip__activity">
          <span class="lane-tooltip__activity-dot" style="background: ${activity.color}"></span>
          ${activity.name}
        </div>
        <div class="lane-tooltip__time">${this.formatTimeAMPM(status.entry.start)} - ${this.formatTimeAMPM(status.entry.end)}</div>
        <div class="lane-tooltip__location">${sectionName} - Lane ${lane}</div>
      `;
    } else {
      html = `
        <div class="lane-tooltip__no-match">Closed / No activity</div>
        <div class="lane-tooltip__location">${sectionName} - Lane ${lane}</div>
      `;
    }
    
    this.elements.laneTooltipContent.innerHTML = html;
    this.elements.laneTooltip.classList.add('lane-tooltip--visible');
    this.positionTooltip(e);
  }
  
  /**
   * Scroll grid to current time row
   */
  scrollToCurrentTime() {
    const container = this.elements.scheduleGridContainer;
    const currentRow = this.elements.scheduleGrid.querySelector('.schedule-grid__row--current');
    
    if (container && currentRow) {
      // Scroll so current time is roughly in the upper third of visible area
      const containerHeight = container.clientHeight;
      const rowTop = currentRow.offsetTop;
      const scrollTarget = rowTop - (containerHeight / 4);
      
      container.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth'
      });
    }
  }
  
  /**
   * Update grid header with current date and time info
   */
  updateGridHeader() {
    const today = this.formatDate(new Date());
    const isViewingToday = this.selectedDate === today;
    const currentTimeMinutes = this.getCurrentTimeMinutes();
    const poolHours = this.schedule.getPoolHours(this.selectedDate);
    
    // Update date title
    const date = new Date(this.selectedDate + 'T12:00:00');
    const dateDisplay = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    if (this.elements.gridDateTitle) {
      this.elements.gridDateTitle.textContent = dateDisplay;
    }
    
    // Update time display
    const timeStr = this.schedule.minutesToTimeString(currentTimeMinutes);
    if (this.elements.gridTimeDisplay) {
      this.elements.gridTimeDisplay.textContent = timeStr;
    }
    
    // Update live indicator
    const isPoolOpen = poolHours && currentTimeMinutes >= poolHours.open && currentTimeMinutes < poolHours.close;
    if (this.elements.gridLiveIndicator) {
      if (isViewingToday && isPoolOpen) {
        this.elements.gridLiveIndicator.classList.add('time-now-btn__live--active');
      } else {
        this.elements.gridLiveIndicator.classList.remove('time-now-btn__live--active');
      }
    }
  }
  
  /**
   * Setup grid-specific event listeners
   */
  setupGridEventListeners() {
    // Grid date navigation
    if (this.elements.gridPrevDay) {
      this.elements.gridPrevDay.addEventListener('click', () => this.navigateDay(-1));
    }
    if (this.elements.gridNextDay) {
      this.elements.gridNextDay.addEventListener('click', () => this.navigateDay(1));
    }
    
    // Grid date picker
    if (this.elements.gridDatePickerBtn) {
      this.elements.gridDatePickerBtn.addEventListener('click', () => this.toggleGridDatePicker());
    }
    if (this.elements.gridPrevMonth) {
      this.elements.gridPrevMonth.addEventListener('click', () => this.navigateMonth(-1));
    }
    if (this.elements.gridNextMonth) {
      this.elements.gridNextMonth.addEventListener('click', () => this.navigateMonth(1));
    }
    
    // Close grid date picker when clicking outside
    document.addEventListener('click', (e) => {
      if (this.elements.gridDatePicker && 
          !this.elements.gridDatePicker.contains(e.target) && 
          !this.elements.gridDatePickerBtn?.contains(e.target)) {
        this.closeGridDatePicker();
      }
    });
    
    // Grid Now button - scroll to current time
    if (this.elements.gridBtnNow) {
      this.elements.gridBtnNow.addEventListener('click', () => {
        this.selectedDate = this.formatDate(new Date());
        this.renderGridView();
        this.renderGridLegend();
        this.updateGridQuickFilterButtons();
      });
    }
    
    // Grid legend toggle
    if (this.elements.gridLegendToggle) {
      this.elements.gridLegendToggle.addEventListener('click', () => this.toggleGridLegend());
    }
    
    // Grid quick filter buttons
    if (this.elements.gridQuickFilterOpenSwim) {
      this.elements.gridQuickFilterOpenSwim.addEventListener('click', () => {
        this.selectOpenSwimFilter();
        if (this.currentView === 'grid') {
          this.renderGridView();
          this.updateGridLegendStates();
        }
      });
    }
    if (this.elements.gridQuickFilterShowAll) {
      this.elements.gridQuickFilterShowAll.addEventListener('click', () => {
        this.clearAllFilters();
        if (this.currentView === 'grid') {
          this.renderGridView();
        }
      });
    }
    
    // Grid clear filter button
    if (this.elements.gridClearFilterBtn) {
      this.elements.gridClearFilterBtn.addEventListener('click', () => {
        this.clearFilter();
        if (this.currentView === 'grid') {
          this.renderGridView();
        }
      });
    }
  }
  
  /**
   * Toggle grid date picker
   */
  toggleGridDatePicker() {
    if (this.gridDatePickerOpen) {
      this.closeGridDatePicker();
    } else {
      this.openGridDatePicker();
    }
  }
  
  openGridDatePicker() {
    this.pickerMonth = new Date(this.selectedDate + 'T12:00:00');
    this.renderGridDatePicker();
    if (this.elements.gridDatePicker) {
      this.elements.gridDatePicker.classList.add('date-picker--open');
    }
    this.gridDatePickerOpen = true;
  }
  
  closeGridDatePicker() {
    if (this.elements.gridDatePicker) {
      this.elements.gridDatePicker.classList.remove('date-picker--open');
    }
    this.gridDatePickerOpen = false;
  }
  
  renderGridDatePicker() {
    const year = this.pickerMonth.getFullYear();
    const month = this.pickerMonth.getMonth();
    
    // Update month label
    const monthName = this.pickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (this.elements.gridPickerMonth) {
      this.elements.gridPickerMonth.textContent = monthName;
    }
    
    // Clear days
    if (!this.elements.gridPickerDays) return;
    this.elements.gridPickerDays.innerHTML = '';
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    // Fill in days from previous month
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonth.getDate() - i;
      const btn = this.createGridDayButton(new Date(year, month - 1, day), true);
      this.elements.gridPickerDays.appendChild(btn);
    }
    
    // Fill in current month days
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const btn = this.createGridDayButton(date, false);
      this.elements.gridPickerDays.appendChild(btn);
    }
    
    // Fill in days from next month
    const remainingSlots = 42 - this.elements.gridPickerDays.children.length;
    for (let day = 1; day <= remainingSlots; day++) {
      const btn = this.createGridDayButton(new Date(year, month + 1, day), true);
      this.elements.gridPickerDays.appendChild(btn);
    }
  }
  
  createGridDayButton(date, isOtherMonth) {
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
      this.closeGridDatePicker();
      if (this.currentView === 'grid') {
        this.renderGridView();
      }
    });
    
    return btn;
  }
  
  /**
   * Toggle grid legend sidebar
   */
  toggleGridLegend() {
    if (this.elements.gridLegendSidebar) {
      this.elements.gridLegendSidebar.classList.toggle('legend-sidebar--hidden');
    }
    if (this.elements.gridLegendToggle) {
      this.elements.gridLegendToggle.classList.toggle('legend-toggle--collapsed');
    }
    // Toggle expanded mode for grid view (legend hidden)
    if (this.elements.gridView) {
      this.elements.gridView.classList.toggle('grid-view--expanded');
    }
  }
  
  /**
   * Render the legend for grid view
   */
  renderGridLegend() {
    const container = this.elements.gridLegendGrid;
    if (!container) return;
    
    container.innerHTML = '';
    
    const activities = this.schedule.getActivities();
    const categories = this.schedule.getActivityCategories();
    
    // Build category groups
    const categoryGroups = {};
    categories.forEach(cat => {
      categoryGroups[cat.id] = {
        name: cat.name,
        activities: activities
          .filter(a => a.category === cat.id)
          .sort((a, b) => a.name.localeCompare(b.name))
      };
    });
    
    // Render each category
    categories.forEach(cat => {
      const group = categoryGroups[cat.id];
      if (group.activities.length === 0) return;
      
      const card = document.createElement('div');
      card.className = 'legend-category-card';
      card.dataset.category = cat.id;
      
      // Category header
      const header = document.createElement('div');
      header.className = 'legend-category__header';
      header.innerHTML = `
        <span class="legend-category__title">${group.name}</span>
        <span class="legend-category__count">${group.activities.length}</span>
      `;
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCategoryFilter(cat.id);
        if (this.currentView === 'grid') {
          this.renderGridView();
          this.updateGridLegendStates();
          this.updateGridFilterUI();
        }
      });
      card.appendChild(header);
      
      // Items container
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'legend-category__items';
      
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
          if (this.currentView === 'grid') {
            this.renderGridView();
            this.updateGridLegendStates();
            this.updateGridFilterUI();
          }
        });
        itemsContainer.appendChild(item);
      });
      
      card.appendChild(itemsContainer);
      container.appendChild(card);
    });
    
    this.updateGridLegendStates();
    this.updateGridFilterUI();
    this.updateGridQuickFilterButtons();
  }
  
  /**
   * Update legend states for grid view
   */
  updateGridLegendStates() {
    if (!this.elements.gridLegendGrid) return;
    
    const cards = this.elements.gridLegendGrid.querySelectorAll('.legend-category-card');
    const items = this.elements.gridLegendGrid.querySelectorAll('.legend-item');
    
    if (this.activeFilters.length === 0) {
      cards.forEach(card => {
        card.classList.remove('legend-category-card--active', 'legend-category-card--dimmed', 'legend-category-card--hidden');
      });
      items.forEach(item => {
        item.classList.remove('legend-item--active', 'legend-item--dimmed');
      });
      return;
    }
    
    const selectedCategoryIds = new Set(
      this.activeFilters.filter(f => f.type === 'category').map(f => f.id)
    );
    const selectedActivityIds = new Set(
      this.activeFilters.filter(f => f.type === 'activity').map(f => f.id)
    );
    
    cards.forEach(card => {
      const isSelected = selectedCategoryIds.has(card.dataset.category);
      card.classList.toggle('legend-category-card--active', isSelected);
      card.classList.toggle('legend-category-card--hidden', this.openSwimQuickMode && !isSelected);
      card.classList.remove('legend-category-card--dimmed');
    });
    
    items.forEach(item => {
      const activityId = item.dataset.activity;
      const categoryId = item.dataset.category;
      
      const isDirectlySelected = selectedActivityIds.has(activityId);
      const isInSelectedCategory = selectedCategoryIds.has(categoryId);
      const isMatching = isDirectlySelected || isInSelectedCategory;
      
      item.classList.toggle('legend-item--active', isDirectlySelected);
      item.classList.toggle('legend-item--dimmed', !isMatching);
    });
  }
  
  /**
   * Update filter UI for grid view
   */
  updateGridFilterUI() {
    const filterValue = document.getElementById('gridFilterValue');
    if (filterValue) {
      if (this.activeFilters.length > 0) {
        const names = this.activeFilters.map(f => f.name);
        if (names.length <= 2) {
          filterValue.textContent = names.join(', ');
        } else {
          filterValue.textContent = `${names.length} selected`;
        }
        if (this.elements.gridClearFilterBtn) {
          this.elements.gridClearFilterBtn.classList.remove('legend-sidebar__clear-btn--hidden');
        }
      } else {
        filterValue.textContent = '';
        if (this.elements.gridClearFilterBtn) {
          this.elements.gridClearFilterBtn.classList.add('legend-sidebar__clear-btn--hidden');
        }
      }
    }
    
    this.updateGridQuickFilterButtons();
  }
  
  /**
   * Update quick filter buttons for grid view
   */
  updateGridQuickFilterButtons() {
    const isOpenSwimQuickActive = this.openSwimQuickMode;
    const isAllActive = this.activeFilters.length === 0 || !this.openSwimQuickMode;
    
    if (this.elements.gridQuickFilterOpenSwim) {
      this.elements.gridQuickFilterOpenSwim.classList.toggle('quick-view-toggle__btn--active', isOpenSwimQuickActive);
    }
    if (this.elements.gridQuickFilterShowAll) {
      this.elements.gridQuickFilterShowAll.classList.toggle('quick-view-toggle__btn--active', isAllActive && !isOpenSwimQuickActive);
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const app = new PoolScheduleApp();
  app.init();
});

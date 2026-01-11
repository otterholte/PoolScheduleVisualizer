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
      // List view elements
      listView: document.getElementById('listView'),
      activityFinder: document.getElementById('activityFinder'),
      segmentTabs: document.getElementById('segmentTabs'),
      segmentIndicator: document.getElementById('segmentIndicator'),
      segmentContent: document.getElementById('segmentContent'),
      activityResults: document.getElementById('activityResults'),
      activityResultsBack: document.getElementById('activityResultsBack'),
      selectedActivityColor: document.getElementById('selectedActivityColor'),
      selectedActivityName: document.getElementById('selectedActivityName'),
      nextUpSection: document.getElementById('nextUpSection'),
      nextUpContent: document.getElementById('nextUpContent'),
      weekGrid: document.getElementById('weekGrid'),
      weekGridHeader: document.getElementById('weekGridHeader'),
      weekGridBody: document.getElementById('weekGridBody'),
      showMoreDays: document.getElementById('showMoreDays')
    };
    
    // Currently selected activity for list view
    this.selectedListActivity = null;
    
    // Pool filter state (set of selected pool names)
    this.selectedPools = new Set();
    
    // Store slot data by date for filter recalculation
    this.slotsByDate = {};
    
    // Currently selected category tab (first one by default)
    this.selectedCategoryTab = null;
    
    // Number of days to show in week grid (can expand)
    this.daysToShow = 7;
    
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
      this.updateSliderRange(true); // forceReset on init
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
    // Update the clock display every second to show live time
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      const timeStr = `${displayHour}:${displayMinutes} ${period}`;
      
      // Always update the clock display with current real time
      if (this.elements.timeDisplay) {
        this.elements.timeDisplay.textContent = timeStr;
      }
    };
    
    // Update clock immediately and then every second
    updateClock();
    setInterval(updateClock, 1000);
    
    // Track minute changes for auto-advancing scrubber
    let lastMinute = new Date().getMinutes();
    
    const checkMinuteChange = () => {
      const now = new Date();
      const currentMinute = now.getMinutes();
      
      if (currentMinute !== lastMinute) {
        lastMinute = currentMinute;
        
        // Check if we're viewing today and at live time
        const today = this.formatDate(now);
        const currentTimeMinutes = this.getCurrentTimeMinutes();
        const isViewingToday = this.selectedDate === today;
        const isAtLiveTime = this.selectedTimeMinutes === currentTimeMinutes - 1 || 
                            this.selectedTimeMinutes === currentTimeMinutes;
        
        if (isViewingToday && isAtLiveTime) {
          // Auto-advance scrubber to current time
          this.selectedTimeMinutes = currentTimeMinutes;
          this.updateTimeSlider();
          this.updateDisplay();
        }
        
        // Always update display indicators (LIVE badge, closed state)
        this.updateDisplayIndicators();
      }
    };
    
    // Check every 10 seconds for minute changes
    setInterval(checkMinuteChange, 10000);
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
    
    // Now button - returns to current time position
    this.elements.btnNow.addEventListener('click', () => {
      this.selectedDate = this.formatDate(new Date());
      this.updateSliderRange(true); // forceReset to current time position
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
    
    // List view back button
    if (this.elements.activityResultsBack) {
      this.elements.activityResultsBack.addEventListener('click', () => this.showActivitySelector());
    }
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
      // Render segmented tabs if not already done
      this.renderSegmentTabs();
      // Show finder, hide results
      this.showActivitySelector();
    }
    
    // Update URL with new view
    this.updateURL();
  }
  
  /**
   * Render the segmented tabs for category selection
   */
  renderSegmentTabs() {
    const tabsContainer = this.elements.segmentTabs;
    if (!tabsContainer) return;
    
    const track = tabsContainer.querySelector('.segment-tabs__track');
    if (!track) return;
    
    // Don't re-render if already populated
    if (track.children.length > 0) return;
    
    const categories = this.schedule.getActivityCategories();
    const activities = this.schedule.getActivities();
    
    // Get categories with activities
    const validCategories = categories.filter(cat => {
      const catActivities = activities.filter(a => a.category === cat.id && a.id !== 'closed');
      return catActivities.length > 0;
    });
    
    // Create tabs
    validCategories.forEach((cat, index) => {
      const tab = document.createElement('button');
      tab.className = 'segment-tab';
      tab.type = 'button';
      tab.dataset.categoryId = cat.id;
      tab.textContent = cat.name;
      
      tab.addEventListener('click', () => this.selectCategoryTab(cat.id));
      
      track.appendChild(tab);
    });
    
    // Select first category by default
    if (validCategories.length > 0) {
      this.selectCategoryTab(validCategories[0].id);
    }
  }
  
  /**
   * Select a category tab and show its activities
   */
  selectCategoryTab(categoryId) {
    this.selectedCategoryTab = categoryId;
    
    // Update tab states
    const tabs = document.querySelectorAll('.segment-tab');
    
    tabs.forEach(tab => {
      const isActive = tab.dataset.categoryId === categoryId;
      tab.classList.toggle('segment-tab--active', isActive);
    });
    
    // Render activities for this category
    this.renderSegmentContent(categoryId);
  }
  
  /**
   * Render activities for the selected category
   */
  renderSegmentContent(categoryId) {
    const container = this.elements.segmentContent;
    if (!container) return;
    
    const activities = this.schedule.getActivities()
      .filter(a => a.category === categoryId && a.id !== 'closed')
      .sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'segment-content__grid';
    
    activities.forEach(activity => {
      const item = document.createElement('button');
      item.className = 'activity-item';
      item.type = 'button';
      item.innerHTML = `
        <span class="activity-item__dot" style="background: ${activity.color}"></span>
        <div class="activity-item__info">
          <span class="activity-item__name">${activity.name}</span>
        </div>
        <svg class="activity-item__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;
      item.addEventListener('click', () => this.selectListActivity(activity.id));
      grid.appendChild(item);
    });
    
    container.appendChild(grid);
  }
  
  /**
   * Select an activity and show upcoming times
   */
  selectListActivity(activityId) {
    const activity = this.schedule.getActivity(activityId);
    if (!activity) return;
    
    this.selectedListActivity = activity;
    this.daysToShow = 7; // Reset days to show
    
    // Update header
    if (this.elements.selectedActivityName) {
      this.elements.selectedActivityName.textContent = activity.name;
    }
    if (this.elements.selectedActivityColor) {
      this.elements.selectedActivityColor.style.background = activity.color;
    }
    
    // Show results, hide finder
    if (this.elements.activityFinder) {
      this.elements.activityFinder.style.display = 'none';
    }
    if (this.elements.activityResults) {
      this.elements.activityResults.style.display = 'flex';
    }
    
    // Render the Concept C results view
    this.renderActivityResults(activityId);
  }
  
  /**
   * Show activity finder, hide results
   */
  showActivitySelector() {
    this.selectedListActivity = null;
    this.elements.activityFinder.style.display = 'flex';
    this.elements.activityResults.style.display = 'none';
  }
  
  /**
   * Render the Concept C results view with Next Up section and Week Grid
   */
  renderActivityResults(activityId) {
    const today = new Date();
    const currentTimeMinutes = this.getCurrentTimeMinutes();
    
    // Reset pool filter
    this.selectedPools = new Set();
    
    // Collect all upcoming slots
    const allSlots = this.collectUpcomingSlots(activityId, 14); // Get 14 days worth
    
    // Store slots for filtering
    this.currentSlots = allSlots;
    
    // Find the next session (current or upcoming)
    const nextSession = allSlots.find(s => s.isCurrent || s.isUpcoming);
    
    // Render Next Up section
    this.renderNextUpSection(nextSession, currentTimeMinutes);
    
    // Render Week Grid (includes filter button in header)
    this.renderWeekGrid(allSlots);
    
    // Setup show more button
    this.setupShowMoreButton(allSlots);
  }
  
  /**
   * Get unique pool names from slots
   */
  getUniquePoolNames(slots) {
    const poolNames = new Map(); // shortName -> fullName
    slots.forEach(slot => {
      const sectionName = slot.section?.name || slot.slot.section;
      const shortName = sectionName
        .replace(' Pool', '')
        .replace(' (25 YARDS)', '')
        .replace('DEEP WELL ', 'DW ');
      if (!poolNames.has(shortName)) {
        poolNames.set(shortName, sectionName);
      }
    });
    return poolNames;
  }
  
  /**
   * Toggle pool filter dropdown
   */
  togglePoolFilterDropdown() {
    const dropdown = document.getElementById('poolFilterDropdown');
    if (dropdown) {
      dropdown.classList.toggle('pool-filter-dropdown--open');
    }
  }
  
  /**
   * Close pool filter dropdown
   */
  closePoolFilterDropdown() {
    const dropdown = document.getElementById('poolFilterDropdown');
    if (dropdown) {
      dropdown.classList.remove('pool-filter-dropdown--open');
    }
  }
  
  /**
   * Toggle a pool in the filter
   */
  togglePoolFilter(poolName) {
    if (this.selectedPools.has(poolName)) {
      this.selectedPools.delete(poolName);
    } else {
      this.selectedPools.add(poolName);
    }
    this.applyPoolFilter();
    this.updatePoolFilterUI();
  }
  
  /**
   * Clear all pool filters
   */
  clearPoolFilters() {
    this.selectedPools.clear();
    this.applyPoolFilter();
    this.updatePoolFilterUI();
  }
  
  /**
   * Update pool filter UI (button and dropdown)
   */
  updatePoolFilterUI() {
    const btn = document.getElementById('poolFilterBtn');
    const countBadge = document.getElementById('poolFilterCount');
    
    if (btn) {
      btn.classList.toggle('pool-filter-btn--active', this.selectedPools.size > 0);
    }
    if (countBadge) {
      if (this.selectedPools.size > 0) {
        countBadge.textContent = this.selectedPools.size;
        countBadge.style.display = 'inline';
      } else {
        countBadge.style.display = 'none';
      }
    }
    
    // Update checkboxes
    document.querySelectorAll('.pool-filter-option').forEach(opt => {
      const poolName = opt.dataset.pool;
      opt.classList.toggle('pool-filter-option--selected', this.selectedPools.has(poolName));
    });
  }
  
  /**
   * Apply pool filter to table rows and recalculate availability windows
   */
  applyPoolFilter() {
    // Filter table rows
    document.querySelectorAll('.pool-row').forEach(row => {
      const poolName = row.dataset.pool || '';
      const matches = this.selectedPools.size === 0 || this.selectedPools.has(poolName);
      row.classList.toggle('pool-row--hidden', !matches);
    });
    
    // Recalculate availability windows for each day
    document.querySelectorAll('.sessions-collapsible').forEach(container => {
      const dateStr = container.dataset.date;
      const windowsContainer = container.querySelector('.availability-windows');
      
      if (!dateStr || !windowsContainer || !this.slotsByDate[dateStr]) return;
      
      // Get slots for this day
      const allSlots = this.slotsByDate[dateStr];
      
      // Filter slots based on selected pools
      const filteredSlots = this.selectedPools.size === 0 
        ? allSlots 
        : allSlots.filter(slot => this.selectedPools.has(slot.shortName));
      
      if (filteredSlots.length === 0) {
        windowsContainer.innerHTML = '<span class="no-matching-pools">No matching pools</span>';
        return;
      }
      
      // Recalculate windows from filtered slots
      const windows = this.mergeIntoAvailabilityWindows(filteredSlots);
      const uniqueId = `day-${dateStr.replace(/-/g, '')}`;
      
      // Build HTML - buttons first, then details as siblings
      let buttonsHtml = '';
      let detailsHtml = '';
      
      windows.forEach((w, windowIdx) => {
        if (w.isGrouped) {
          const windowId = `${uniqueId}-w${windowIdx}`;
          const poolTable = this.groupSlotsByPool(w.slots);
          const tableHtml = poolTable.map(pool => `
            <div class="pool-row" data-pool="${pool.shortName}">
              <span class="pool-row__name">${pool.shortName}</span>
              <span class="pool-row__times">${pool.times.map(t => `${this.formatTimeAMPM(t.start)} - ${this.formatTimeAMPM(t.end)}`).join(', ')}</span>
            </div>
          `).join('');
          
          buttonsHtml += `
            <div class="availability-window-group" id="${windowId}">
              <button class="availability-window" data-toggle="${windowId}">
                <svg class="availability-window__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span class="availability-window__time">${this.formatTimeAMPM(w.start)} - ${this.formatTimeAMPM(w.end)}</span>
                <span class="availability-window__count">${w.poolCount} pool${w.poolCount > 1 ? 's' : ''}</span>
              </button>
            </div>
          `;
          
          detailsHtml += `
            <div class="availability-window-detail" id="${windowId}-detail" data-group="${windowId}" style="display: none;">
              <div class="pool-table">
                <div class="pool-table__header">
                  <span class="pool-table__col-pool">Pool</span>
                  <span class="pool-table__col-times">Available Hours</span>
                </div>
                ${tableHtml}
              </div>
            </div>
          `;
        } else {
          const slot = w.slots[0];
          const shortName = slot.shortName || slot.slot.section;
          buttonsHtml += `
            <div class="session-chip session-chip--individual">
              <span class="session-chip__time">${this.formatTimeAMPM(w.start)} - ${this.formatTimeAMPM(w.end)}</span>
              <span class="session-chip__location">${shortName}</span>
            </div>
          `;
        }
      });
      
      windowsContainer.innerHTML = buttonsHtml + detailsHtml;
      
      // Re-attach click handlers for grouped windows (with accordion behavior)
      windowsContainer.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
          const windowId = btn.dataset.toggle;
          const windowGroup = document.getElementById(windowId);
          const detail = document.getElementById(`${windowId}-detail`);
          if (windowGroup && detail) {
            const isExpanded = detail.style.display === 'block';
            
            // Accordion: collapse all other expanded groups first
            if (!isExpanded) {
              document.querySelectorAll('.availability-window-group--expanded').forEach(group => {
                group.classList.remove('availability-window-group--expanded');
              });
              document.querySelectorAll('.availability-window-detail').forEach(d => {
                d.style.display = 'none';
              });
            }
            
            detail.style.display = isExpanded ? 'none' : 'block';
            windowGroup.classList.toggle('availability-window-group--expanded', !isExpanded);
          }
        });
      });
    });
  }
  
  /**
   * Setup pool filter event listeners
   */
  setupPoolFilterListeners() {
    const btn = document.getElementById('poolFilterBtn');
    const dropdown = document.getElementById('poolFilterDropdown');
    const clearBtn = document.getElementById('poolFilterClear');
    
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePoolFilterDropdown();
      });
    }
    
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearPoolFilters();
      });
    }
    
    // Pool options
    document.querySelectorAll('.pool-filter-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const poolName = opt.dataset.pool;
        this.togglePoolFilter(poolName);
      });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== btn) {
        this.closePoolFilterDropdown();
      }
    });
  }
  
  /**
   * Collect upcoming slots for an activity over multiple days
   */
  collectUpcomingSlots(activityId, numDays) {
    const today = new Date();
    const currentTimeMinutes = this.getCurrentTimeMinutes();
    const upcomingSlots = [];
    
    for (let i = 0; i < numDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = this.formatDate(date);
      
      const slots = this.schedule.findActivitySlots(dateStr, activityId);
      
      slots.forEach(slot => {
        const startMinutes = this.schedule.timeToMinutes(slot.start);
        const endMinutes = this.schedule.timeToMinutes(slot.end);
        
        // Skip past events on today
        if (i === 0 && endMinutes <= currentTimeMinutes) return;
        
        const isCurrent = i === 0 && currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes;
        const isUpcoming = i === 0 && startMinutes > currentTimeMinutes;
        
        const section = this.schedule.getSection(slot.section);
        
        upcomingSlots.push({
          date: dateStr,
          dateObj: new Date(date),
          dayIndex: i,
          slot,
          section,
          startMinutes,
          endMinutes,
          isCurrent,
          isUpcoming: isUpcoming && !isCurrent
        });
      });
    }
    
    // Sort by date then time
    upcomingSlots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startMinutes - b.startMinutes;
    });
    
    // Mark only the first upcoming (non-current) as "next"
    let foundNext = false;
    upcomingSlots.forEach(slot => {
      if ((slot.isCurrent || slot.isUpcoming) && !foundNext) {
        slot.isNext = !slot.isCurrent;
        foundNext = true;
      }
    });
    
    return upcomingSlots;
  }
  
  /**
   * Render the "Next Up" section
   */
  renderNextUpSection(nextSession, currentTimeMinutes) {
    const section = this.elements.nextUpSection;
    const content = this.elements.nextUpContent;
    if (!section || !content) return;
    
    // Reset classes
    section.className = 'next-up';
    
    if (!nextSession) {
      section.classList.add('next-up--empty');
      content.innerHTML = `
        <span class="next-up__empty-message">No upcoming sessions scheduled</span>
      `;
      return;
    }
    
    // Format time prefix
    let timePrefix = '';
    if (nextSession.isCurrent) {
      section.classList.add('next-up--happening');
      timePrefix = 'NOW';
    } else if (nextSession.dayIndex === 0) {
      timePrefix = 'TODAY @';
    } else if (nextSession.dayIndex === 1) {
      timePrefix = 'TOMORROW @';
    } else {
      const dayName = nextSession.dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      timePrefix = `${dayName} @`;
    }
    
    // Format location
    const sectionName = nextSession.section?.name || nextSession.slot.section;
    const lanes = nextSession.slot.lanes;
    let lanesStr = '';
    if (lanes.length === 1) {
      lanesStr = `Lane ${lanes[0]}`;
    } else if (lanes.every(l => typeof l === 'number')) {
      const sorted = [...lanes].sort((a, b) => a - b);
      if (sorted.length > 2 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1) {
        lanesStr = `Lanes ${sorted[0]}-${sorted[sorted.length - 1]}`;
      } else {
        lanesStr = `Lanes ${sorted.join(', ')}`;
      }
    } else {
      lanesStr = lanes.join(', ');
    }
    
    // Calculate countdown
    let countdownHtml = '';
    if (nextSession.isCurrent) {
      const endsIn = nextSession.endMinutes - currentTimeMinutes;
      countdownHtml = `
        <div class="next-up__countdown">
          <div class="next-up__countdown-label">Ends in</div>
          <div class="next-up__countdown-value">${this.formatDuration(endsIn)}</div>
        </div>
      `;
    } else if (nextSession.dayIndex === 0) {
      const startsIn = nextSession.startMinutes - currentTimeMinutes;
      countdownHtml = `
        <div class="next-up__countdown">
          <div class="next-up__countdown-label">Starts in</div>
          <div class="next-up__countdown-value">${this.formatDuration(startsIn)}</div>
        </div>
      `;
    }
    
    const timeStr = `${this.formatTimeAMPM(nextSession.slot.start)} - ${this.formatTimeAMPM(nextSession.slot.end)}`;
    
    content.innerHTML = `
      <div class="next-up__main">
        <div class="next-up__time">
          <span class="next-up__time-prefix">${timePrefix}</span>
          ${timeStr}
        </div>
        <div class="next-up__location">${sectionName}, ${lanesStr}</div>
      </div>
      ${countdownHtml}
    `;
  }
  
  /**
   * Format duration in minutes to a readable string
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  }
  
  /**
   * Render the week grid with sessions
   */
  renderWeekGrid(allSlots) {
    const header = this.elements.weekGridHeader;
    const body = this.elements.weekGridBody;
    if (!header || !body) return;
    
    // Group slots by date
    const byDate = {};
    allSlots.forEach(slot => {
      if (!byDate[slot.date]) {
        byDate[slot.date] = {
          dateObj: slot.dateObj,
          dayIndex: slot.dayIndex,
          slots: []
        };
      }
      byDate[slot.date].slots.push(slot);
    });
    
    // Get the dates we want to show
    const today = new Date();
    const datesToShow = [];
    for (let i = 0; i < this.daysToShow; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      datesToShow.push(this.formatDate(date));
    }
    
    // Render header
    const startDate = new Date(today);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + this.daysToShow - 1);
    
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Get unique pools for filter
    const poolNames = this.getUniquePoolNames(allSlots);
    const poolOptionsHtml = [...poolNames.keys()].sort().map(shortName => `
      <button class="pool-filter-option" type="button" data-pool="${shortName}">
        <span class="pool-filter-option__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span>${shortName}</span>
      </button>
    `).join('');
    
    header.innerHTML = `
      <span class="week-grid__title">Schedule: ${startStr} - ${endStr}</span>
      <div style="position: relative;">
        <button class="pool-filter-btn" id="poolFilterBtn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>Pools</span>
          <span class="pool-filter-btn__count" id="poolFilterCount" style="display: none;">0</span>
        </button>
        <div class="pool-filter-dropdown" id="poolFilterDropdown">
          <div class="pool-filter-dropdown__header">
            <span class="pool-filter-dropdown__title">Filter by Pool</span>
            <button class="pool-filter-dropdown__clear" type="button" id="poolFilterClear">Clear all</button>
          </div>
          <div class="pool-filter-dropdown__list">
            ${poolOptionsHtml}
          </div>
        </div>
      </div>
    `;
    
    // Setup filter event listeners
    this.setupPoolFilterListeners();
    
    // Render body
    body.innerHTML = '';
    
    datesToShow.forEach((dateStr, idx) => {
      const dayData = byDate[dateStr];
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Day badge
      let badgeHtml = '';
      if (idx === 0) {
        badgeHtml = '<span class="week-day__badge">Today</span>';
      } else if (idx === 1) {
        badgeHtml = '<span class="week-day__badge" style="background: rgba(59, 130, 246, 0.15); color: var(--accent-blue);">Tomorrow</span>';
      }
      
      const dayRow = document.createElement('div');
      dayRow.className = 'week-day';
      
      // Sessions HTML
      let sessionsHtml = '';
      if (dayData && dayData.slots.length > 0) {
        const slots = dayData.slots;
        const shouldCollapse = slots.length >= 4;
        
        // Enrich slots with shortName for filtering
        const enrichedSlots = slots.map(slot => {
          const sectionName = slot.section?.name || slot.slot.section;
          const shortName = sectionName
            .replace(' Pool', '')
            .replace(' (25 YARDS)', '')
            .replace('DEEP WELL ', 'DW ');
          return { ...slot, shortName };
        });
        
        // Store slots for this day (for filter recalculation)
        this.slotsByDate[dateStr] = enrichedSlots;
        
        if (shouldCollapse) {
          // Merge overlapping times into availability windows
          const windows = this.mergeIntoAvailabilityWindows(enrichedSlots);
          const uniqueId = `day-${dateStr.replace(/-/g, '')}`;
          
          // Build HTML for each window - buttons first, then details
          let buttonsHtml = '';
          let detailsHtml = '';
          
          windows.forEach((w, windowIdx) => {
            if (w.isGrouped) {
              // Grouped window - button and detail are siblings
              const windowId = `${uniqueId}-w${windowIdx}`;
              const poolTable = this.groupSlotsByPool(w.slots);
              const tableHtml = poolTable.map(pool => `
                <div class="pool-row" data-pool="${pool.shortName}">
                  <span class="pool-row__name">${pool.shortName}</span>
                  <span class="pool-row__times">${pool.times.map(t => `${this.formatTimeAMPM(t.start)} - ${this.formatTimeAMPM(t.end)}`).join(', ')}</span>
                </div>
              `).join('');
              
              buttonsHtml += `
                <div class="availability-window-group" id="${windowId}">
                  <button class="availability-window" data-toggle="${windowId}">
                    <svg class="availability-window__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <span class="availability-window__time">${this.formatTimeAMPM(w.start)} - ${this.formatTimeAMPM(w.end)}</span>
                    <span class="availability-window__count">${w.poolCount} pool${w.poolCount > 1 ? 's' : ''}</span>
                  </button>
                </div>
              `;
              
              detailsHtml += `
                <div class="availability-window-detail" id="${windowId}-detail" data-group="${windowId}" style="display: none;">
                  <div class="pool-table">
                    <div class="pool-table__header">
                      <span class="pool-table__col-pool">Pool</span>
                      <span class="pool-table__col-times">Available Hours</span>
                    </div>
                    ${tableHtml}
                  </div>
                </div>
              `;
            } else {
              // Individual slot - show as simple chip
              const slot = w.slots[0];
              const shortName = slot.shortName || slot.slot.section;
              buttonsHtml += `
                <div class="session-chip session-chip--individual">
                  <span class="session-chip__time">${this.formatTimeAMPM(w.start)} - ${this.formatTimeAMPM(w.end)}</span>
                  <span class="session-chip__location">${shortName}</span>
                </div>
              `;
            }
          });
          
          const windowsHtml = buttonsHtml + detailsHtml;
          
          sessionsHtml = `
            <div class="sessions-collapsible" id="${uniqueId}" data-date="${dateStr}">
              <div class="availability-windows" id="${uniqueId}-windows">
                ${windowsHtml}
              </div>
            </div>
          `;
        } else {
          // Normal view for fewer sessions
          slots.forEach(slot => {
            let chipClass = 'session-chip';
            if (slot.isCurrent) chipClass += ' session-chip--now';
            else if (slot.isNext) chipClass += ' session-chip--next';
            
            const sectionName = slot.section?.name || slot.slot.section;
            const shortSection = sectionName.replace(' Pool', '').replace(' (25 YARDS)', '').replace('DEEP WELL ', 'DW ');
            
            sessionsHtml += `
              <div class="${chipClass}">
                <span class="session-chip__time">${this.formatTimeAMPM(slot.slot.start)} - ${this.formatTimeAMPM(slot.slot.end)}</span>
                <span class="session-chip__location">${shortSection}</span>
              </div>
            `;
          });
        }
      } else {
        sessionsHtml = '<span class="week-day__no-sessions">No sessions</span>';
      }
      
      dayRow.innerHTML = `
        <div class="week-day__label">
          <span class="week-day__name">${dayName}</span>
          <span class="week-day__date">${dateDisplay}</span>
          ${badgeHtml}
        </div>
        <div class="week-day__sessions">${sessionsHtml}</div>
      `;
      
      body.appendChild(dayRow);
    });
    
    // Add click handlers for expand/collapse toggles
    this.setupSessionToggles();
  }
  
  /**
   * Render availability windows - grouped windows get expand buttons, individual slots get chips
   */
  renderAvailabilityWindowButtons(windows, uniqueId) {
    return windows.map(w => {
      if (w.isGrouped) {
        // Grouped window with 2+ overlapping slots - show expandable button
        return `
          <button class="availability-window" data-toggle="${uniqueId}">
            <svg class="availability-window__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span class="availability-window__time">${this.formatTimeAMPM(w.start)} - ${this.formatTimeAMPM(w.end)}</span>
            <span class="availability-window__count">${w.poolCount} pool${w.poolCount > 1 ? 's' : ''}</span>
          </button>
        `;
      } else {
        // Individual slot with no overlap - show as simple chip
        const slot = w.slots[0];
        const shortName = slot.shortName || slot.slot.section;
        return `
          <div class="session-chip session-chip--individual">
            <span class="session-chip__time">${this.formatTimeAMPM(w.start)} - ${this.formatTimeAMPM(w.end)}</span>
            <span class="session-chip__location">${shortName}</span>
          </div>
        `;
      }
    }).join('');
  }
  
  /**
   * Merge overlapping slots into availability windows
   * Returns both grouped windows (2+ overlapping slots) and individual slots (no overlap)
   */
  mergeIntoAvailabilityWindows(slots) {
    // Sort by start time
    const sorted = [...slots].sort((a, b) => a.startMinutes - b.startMinutes);
    
    const windows = [];
    let currentWindow = null;
    
    sorted.forEach(slot => {
      if (!currentWindow) {
        // Start new window
        currentWindow = {
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          start: slot.slot.start,
          end: slot.slot.end,
          pools: new Set([slot.slot.section]),
          slots: [slot]  // Track all slots in this window
        };
      } else if (slot.startMinutes <= currentWindow.endMinutes) {
        // Overlaps or touches current window - add to it
        if (slot.endMinutes > currentWindow.endMinutes) {
          currentWindow.endMinutes = slot.endMinutes;
          currentWindow.end = slot.slot.end;
        }
        currentWindow.pools.add(slot.slot.section);
        currentWindow.slots.push(slot);
      } else {
        // Gap - save current window and start new one
        windows.push({
          start: currentWindow.start,
          end: currentWindow.end,
          poolCount: currentWindow.pools.size,
          slotCount: currentWindow.slots.length,
          isGrouped: currentWindow.slots.length > 1,
          slots: currentWindow.slots
        });
        currentWindow = {
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          start: slot.slot.start,
          end: slot.slot.end,
          pools: new Set([slot.slot.section]),
          slots: [slot]
        };
      }
    });
    
    // Don't forget the last window
    if (currentWindow) {
      windows.push({
        start: currentWindow.start,
        end: currentWindow.end,
        poolCount: currentWindow.pools.size,
        slotCount: currentWindow.slots.length,
        isGrouped: currentWindow.slots.length > 1,
        slots: currentWindow.slots
      });
    }
    
    return windows;
  }
  
  /**
   * Group slots by pool for table display
   */
  groupSlotsByPool(slots) {
    const byPool = {};
    
    slots.forEach(slot => {
      const sectionName = slot.section?.name || slot.slot.section;
      const shortName = sectionName
        .replace(' Pool', '')
        .replace(' (25 YARDS)', '')
        .replace('DEEP WELL ', 'DW ');
      
      if (!byPool[sectionName]) {
        byPool[sectionName] = {
          name: sectionName,
          shortName: shortName,
          times: []
        };
      }
      
      byPool[sectionName].times.push({
        start: slot.slot.start,
        end: slot.slot.end,
        startMinutes: slot.startMinutes
      });
    });
    
    // Sort times within each pool and return as array
    return Object.values(byPool).map(pool => {
      pool.times.sort((a, b) => a.startMinutes - b.startMinutes);
      return pool;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * Setup click handlers for session expand/collapse toggles
   */
  setupSessionToggles() {
    document.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const windowId = btn.dataset.toggle;
        const windowGroup = document.getElementById(windowId);
        const detail = document.getElementById(`${windowId}-detail`);
        
        if (windowGroup && detail) {
          const isExpanded = detail.style.display === 'block';
          
          // Accordion: collapse all other expanded groups first
          if (!isExpanded) {
            document.querySelectorAll('.availability-window-group--expanded').forEach(group => {
              group.classList.remove('availability-window-group--expanded');
            });
            document.querySelectorAll('.availability-window-detail').forEach(d => {
              d.style.display = 'none';
            });
          }
          
          detail.style.display = isExpanded ? 'none' : 'block';
          windowGroup.classList.toggle('availability-window-group--expanded', !isExpanded);
        }
      });
    });
  }
  
  /**
   * Setup the "Show More Days" button
   */
  setupShowMoreButton(allSlots) {
    const btn = this.elements.showMoreDays;
    if (!btn) return;
    
    // Check if there are more slots beyond daysToShow
    const hasMore = allSlots.some(s => s.dayIndex >= this.daysToShow);
    
    if (hasMore) {
      btn.classList.remove('show-more-days--hidden');
      btn.onclick = () => {
        this.daysToShow += 7;
        this.renderWeekGrid(allSlots);
        this.setupShowMoreButton(allSlots);
      };
    } else {
      btn.classList.add('show-more-days--hidden');
    }
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
    this.updateSliderRange(true); // forceReset when changing dates
    this.updateDisplay();
  }

  updateSliderRange(forceReset = false) {
    const hours = this.schedule.getPoolHours(this.selectedDate);
    if (!hours) return;
    
    const slider = this.elements.timeSlider;
    slider.min = hours.open;
    slider.max = hours.close;
    
    const today = this.formatDate(new Date());
    const isViewingToday = this.selectedDate === today;
    const currentRealTimeMinutes = this.getCurrentTimeMinutes();
    
    // Only auto-position on initial load or when explicitly requested (forceReset)
    // This allows manual scrubbing without being overridden
    if (forceReset) {
      if (isViewingToday) {
        if (currentRealTimeMinutes >= hours.close) {
          // After closing (until midnight) - slider at right (close time)
          this.selectedTimeMinutes = hours.close;
        } else if (currentRealTimeMinutes < hours.open) {
          // Before opening (after midnight) - slider at left (open time)
          this.selectedTimeMinutes = hours.open;
        } else {
          // During operating hours - slider follows current time
          this.selectedTimeMinutes = currentRealTimeMinutes;
        }
      }
    }
    
    // Always clamp to valid range (but don't change position otherwise)
    if (this.selectedTimeMinutes < hours.open) {
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
    
    // Note: Time display is now handled by setupClock() for live updates
    
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
  
  /**
   * Update display indicators (LIVE badge, closed state) without full refresh
   */
  updateDisplayIndicators() {
    const today = this.formatDate(new Date());
    const isViewingToday = this.selectedDate === today;
    const currentRealTimeMinutes = this.getCurrentTimeMinutes();
    const poolHours = this.schedule.getPoolHours(this.selectedDate);
    
    if (!poolHours) return;
    
    // Check if pool is CURRENTLY closed
    const isCurrentlyClosed = isViewingToday && (
      currentRealTimeMinutes < poolHours.open || 
      currentRealTimeMinutes >= poolHours.close
    );
    
    // Determine if we should show the LIVE badge
    const isLive = this.selectedTimeMinutes === currentRealTimeMinutes && 
                   isViewingToday && !isCurrentlyClosed;
    
    // Update live/closed indicators
    if (isCurrentlyClosed) {
      this.elements.liveIndicator.classList.remove('time-now-btn__live--active');
      this.elements.closedIndicator.classList.add('time-now-btn__closed--active');
      this.updateNextOpenTime(poolHours, currentRealTimeMinutes);
    } else {
      this.elements.closedIndicator.classList.remove('time-now-btn__closed--active');
      if (isLive) {
        this.elements.liveIndicator.classList.add('time-now-btn__live--active');
      } else {
        this.elements.liveIndicator.classList.remove('time-now-btn__live--active');
      }
    }
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

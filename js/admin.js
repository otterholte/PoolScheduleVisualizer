/**
 * Admin Panel - Schedule Manager
 */

class AdminPanel {
  constructor() {
    this.schedule = scheduleManager;
    this.currentEditId = null;
    this.pendingSchedules = {}; // Local copy of schedules for editing
    
    // DOM Elements
    this.elements = {
      form: document.getElementById('scheduleForm'),
      formTitle: document.getElementById('formTitle'),
      formModal: document.getElementById('formModal'),
      addEntryBtn: document.getElementById('addEntryBtn'),
      closeModal: document.getElementById('closeModal'),
      entryDate: document.getElementById('entryDate'),
      entrySection: document.getElementById('entrySection'),
      laneSelector: document.getElementById('laneSelector'),
      entryStart: document.getElementById('entryStart'),
      entryEnd: document.getElementById('entryEnd'),
      entryActivity: document.getElementById('entryActivity'),
      activityPreview: document.getElementById('activityPreview'),
      activityColor: document.getElementById('activityColor'),
      activityName: document.getElementById('activityName'),
      submitBtn: document.getElementById('submitBtn'),
      clearBtn: document.getElementById('clearBtn'),
      previewDate: document.getElementById('previewDate'),
      previewDateDisplay: document.getElementById('previewDateDisplay'),
      clearDayBtn: document.getElementById('clearDayBtn'),
      scheduleList: document.getElementById('scheduleList'),
      exportBtn: document.getElementById('exportBtn'),
      importFile: document.getElementById('importFile'),
      previewJsonBtn: document.getElementById('previewJsonBtn'),
      jsonPreview: document.getElementById('jsonPreview'),
      jsonCode: document.getElementById('jsonCode'),
      toast: document.getElementById('toast'),
      toastMessage: document.getElementById('toastMessage'),
      quickTimeButtons: document.getElementById('quickTimeButtons'),
      // View toggle elements
      viewToggle: document.getElementById('adminViewToggle'),
      listView: document.getElementById('adminListView'),
      gridView: document.getElementById('adminGridView'),
      scheduleGrid: document.getElementById('adminScheduleGrid'),
      scheduleGridContainer: document.getElementById('adminScheduleGridContainer'),
      gridLegendGrid: document.getElementById('adminGridLegendGrid'),
      gridLegendSidebar: document.getElementById('adminGridLegendSidebar'),
      gridLegendToggle: document.getElementById('adminGridLegendToggle'),
      gridQuickFilterOpenSwim: document.getElementById('adminGridQuickFilterOpenSwim'),
      gridQuickFilterShowAll: document.getElementById('adminGridQuickFilterShowAll'),
      gridClearFilterBtn: document.getElementById('adminGridClearFilterBtn'),
      gridDateLabel: document.getElementById('adminGridDateLabel'),
      gridTimeDisplay: document.getElementById('adminGridTimeDisplay'),
      gridBtnNow: document.getElementById('adminGridBtnNow'),
      gridPrevDay: document.getElementById('adminGridPrevDay'),
      gridNextDay: document.getElementById('adminGridNextDay'),
      gridDatePickerBtn: document.getElementById('adminGridDatePickerBtn'),
      gridDatePicker: document.getElementById('adminGridDatePicker'),
      gridPickerMonth: document.getElementById('adminGridPickerMonth'),
      gridPickerDays: document.getElementById('adminGridPickerDays'),
      gridPrevMonth: document.getElementById('adminGridPrevMonth'),
      gridNextMonth: document.getElementById('adminGridNextMonth'),
      laneTooltip: document.getElementById('adminLaneTooltip'),
      laneTooltipContent: document.getElementById('adminLaneTooltipContent')
    };
    
    // Current view: 'list' or 'grid'
    this.currentView = 'list';
    
    // Filter state for grid view
    this.activeFilters = [];
    this.openSwimQuickMode = false;
    
    // Tooltip timer
    this.tooltipTimer = null;
    this.pendingTooltipCell = null;
    this.lastTooltipEvent = null;
    
    // Date picker state
    this.gridDatePickerOpen = false;
    this.pickerMonth = new Date();
    
    // Clock update interval
    this.clockInterval = null;
  }

  /**
   * Initialize the admin panel
   */
  async init() {
    try {
      await this.schedule.load();
      
      // Copy schedules for local editing
      this.pendingSchedules = JSON.parse(JSON.stringify(this.schedule.data.schedules || {}));
      
      // Setup UI
      this.populateSections();
      this.populateActivities();
      this.setupEventListeners();
      
      // Set default date to today
      const today = this.formatDate(new Date());
      this.elements.entryDate.value = today;
      this.elements.previewDate.value = today;
      this.updatePreview();
      
      // Setup view toggle and render grid legend
      this.setupViewToggle();
      this.renderGridLegend();
      
    } catch (error) {
      console.error('Failed to initialize admin panel:', error);
      this.showToast('Failed to load schedule data', 'error');
    }
  }

  /**
   * Populate section dropdown
   */
  populateSections() {
    const sections = this.schedule.getPoolLayout()?.sections || [];
    const select = this.elements.entrySection;
    
    sections.forEach(section => {
      const option = document.createElement('option');
      option.value = section.id;
      option.textContent = section.name;
      option.dataset.lanes = JSON.stringify(section.lanes);
      select.appendChild(option);
    });
  }

  /**
   * Populate activities dropdown
   */
  populateActivities() {
    const activities = this.schedule.getActivities();
    const select = this.elements.entryActivity;
    
    activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity.id;
      option.textContent = activity.name;
      option.dataset.color = activity.color;
      select.appendChild(option);
    });
  }

  /**
   * Update lane selector based on selected section
   */
  updateLaneSelector() {
    const select = this.elements.entrySection;
    const selectedOption = select.options[select.selectedIndex];
    const container = this.elements.laneSelector;
    
    container.innerHTML = '';
    
    if (!selectedOption || !selectedOption.dataset.lanes) {
      return;
    }
    
    const lanes = JSON.parse(selectedOption.dataset.lanes);
    
    lanes.forEach(lane => {
      const id = `lane_${lane}`;
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'lane-checkbox';
      checkbox.id = id;
      checkbox.name = 'lanes';
      checkbox.value = lane;
      
      const label = document.createElement('label');
      label.className = 'lane-label';
      label.htmlFor = id;
      label.textContent = lane;
      
      container.appendChild(checkbox);
      container.appendChild(label);
    });
  }

  /**
   * Update activity preview
   */
  updateActivityPreview() {
    const select = this.elements.entryActivity;
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
      this.elements.activityPreview.style.display = 'none';
      return;
    }
    
    const activity = this.schedule.getActivity(selectedOption.value);
    if (activity) {
      this.elements.activityColor.style.background = activity.color;
      this.elements.activityName.textContent = activity.name;
      this.elements.activityPreview.style.display = 'flex';
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Modal open
    this.elements.addEntryBtn.addEventListener('click', () => {
      this.openModal();
    });
    
    // Modal close
    this.elements.closeModal.addEventListener('click', () => {
      this.closeModal();
    });
    
    // Close modal on overlay click
    this.elements.formModal.addEventListener('click', (e) => {
      if (e.target === this.elements.formModal) {
        this.closeModal();
      }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.formModal.classList.contains('active')) {
        this.closeModal();
      }
    });
    
    // Section change - update lanes
    this.elements.entrySection.addEventListener('change', () => {
      this.updateLaneSelector();
    });
    
    // Activity change - update preview
    this.elements.entryActivity.addEventListener('change', () => {
      this.updateActivityPreview();
    });
    
    // Form submit
    this.elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Clear form
    this.elements.clearBtn.addEventListener('click', () => {
      this.resetForm();
    });
    
    // Preview date change - also update grid view
    this.elements.previewDate.addEventListener('change', () => {
      this.updatePreview();
      if (this.currentView === 'grid') {
        this.renderGridView();
      }
    });
    
    // Note: Today button removed - date navigation is now in grid view header
    
    // Clear day
    this.elements.clearDayBtn.addEventListener('click', () => {
      this.clearDay();
    });
    
    // Export
    this.elements.exportBtn.addEventListener('click', () => {
      this.exportSchedule();
    });
    
    // Import
    this.elements.importFile.addEventListener('change', (e) => {
      this.importSchedule(e.target.files[0]);
    });
    
    // Preview JSON
    this.elements.previewJsonBtn.addEventListener('click', () => {
      this.toggleJsonPreview();
    });
    
    // Quick time buttons
    this.elements.quickTimeButtons.addEventListener('click', (e) => {
      if (e.target.classList.contains('quick-add__btn')) {
        this.elements.entryStart.value = e.target.dataset.start;
        this.elements.entryEnd.value = e.target.dataset.end;
      }
    });
    
    // Sync entry date with preview date
    this.elements.entryDate.addEventListener('change', () => {
      this.elements.previewDate.value = this.elements.entryDate.value;
      this.updatePreview();
      if (this.currentView === 'grid') {
        this.renderGridView();
      }
    });
  }

  /**
   * Open the form modal
   */
  openModal() {
    this.elements.formModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Set entry date to preview date
    this.elements.entryDate.value = this.elements.previewDate.value;
  }

  /**
   * Close the form modal
   */
  closeModal() {
    this.elements.formModal.classList.remove('active');
    document.body.style.overflow = '';
    this.resetForm();
  }

  /**
   * Handle form submission
   */
  handleSubmit() {
    const date = this.elements.entryDate.value;
    const section = this.elements.entrySection.value;
    const start = this.elements.entryStart.value;
    const end = this.elements.entryEnd.value;
    const activity = this.elements.entryActivity.value;
    
    // Get selected lanes
    const laneCheckboxes = this.elements.laneSelector.querySelectorAll('input:checked');
    const lanes = Array.from(laneCheckboxes).map(cb => {
      const val = cb.value;
      const num = parseInt(val, 10);
      return isNaN(num) ? val : num;
    });
    
    // Validation
    if (!date || !section || lanes.length === 0 || !start || !end || !activity) {
      this.showToast('Please fill in all required fields', 'error');
      return;
    }
    
    if (start >= end) {
      this.showToast('End time must be after start time', 'error');
      return;
    }
    
    // Create entry
    const entry = {
      section,
      lanes,
      start,
      end,
      activity
    };
    
    // Initialize date array if needed
    if (!this.pendingSchedules[date]) {
      this.pendingSchedules[date] = [];
    }
    
    if (this.currentEditId !== null) {
      // Update existing entry
      this.pendingSchedules[date][this.currentEditId] = entry;
      this.showToast('Entry updated successfully', 'success');
      this.currentEditId = null;
      this.elements.formTitle.textContent = 'Add Schedule Entry';
      this.elements.submitBtn.textContent = 'Add Entry';
    } else {
      // Add new entry
      this.pendingSchedules[date].push(entry);
      this.showToast('Entry added successfully', 'success');
    }
    
    this.closeModal();
    this.updatePreview();
  }

  /**
   * Reset form to default state
   */
  resetForm() {
    this.elements.form.reset();
    this.elements.laneSelector.innerHTML = '';
    this.elements.activityPreview.style.display = 'none';
    this.currentEditId = null;
    this.elements.formTitle.textContent = 'Add Schedule Entry';
    this.elements.submitBtn.textContent = 'Add Entry';
    
    // Keep the date
    const previewDate = this.elements.previewDate.value;
    if (previewDate) {
      this.elements.entryDate.value = previewDate;
    }
  }

  /**
   * Update schedule preview
   */
  updatePreview() {
    const date = this.elements.previewDate.value;
    const dateObj = new Date(date + 'T12:00:00');
    
    this.elements.previewDateDisplay.textContent = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const entries = this.pendingSchedules[date] || [];
    
    if (entries.length === 0) {
      this.elements.scheduleList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📅</div>
          <p class="empty-state__text">No schedule entries for this date.<br>Add one using the form!</p>
        </div>
      `;
      return;
    }
    
    // Sort entries by start time
    const sortedEntries = [...entries].map((entry, idx) => ({ ...entry, _idx: idx }));
    sortedEntries.sort((a, b) => {
      if (a.start < b.start) return -1;
      if (a.start > b.start) return 1;
      return 0;
    });
    
    this.elements.scheduleList.innerHTML = sortedEntries.map(entry => {
      const activity = this.schedule.getActivity(entry.activity);
      const section = this.schedule.getSection(entry.section);
      
      return `
        <div class="schedule-entry" style="border-left-color: ${activity?.color || '#ccc'}">
          <div class="schedule-entry__info">
            <div class="schedule-entry__activity">${activity?.name || entry.activity}</div>
            <div class="schedule-entry__details">
              ${section?.name || entry.section} • Lanes ${entry.lanes.join(', ')} • ${this.formatTime(entry.start)} - ${this.formatTime(entry.end)}
            </div>
          </div>
          <div class="schedule-entry__actions">
            <button class="schedule-entry__btn schedule-entry__btn--edit" onclick="adminPanel.editEntry('${date}', ${entry._idx})" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11,4H4A2,2,0,0,0,2,6V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V13"></path>
                <path d="M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15,8,16l1-4Z"></path>
              </svg>
            </button>
            <button class="schedule-entry__btn schedule-entry__btn--delete" onclick="adminPanel.deleteEntry('${date}', ${entry._idx})" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Edit an entry
   */
  editEntry(date, index) {
    const entry = this.pendingSchedules[date]?.[index];
    if (!entry) return;
    
    // Populate form
    this.elements.entryDate.value = date;
    this.elements.entrySection.value = entry.section;
    this.updateLaneSelector();
    
    // Check the appropriate lane checkboxes
    entry.lanes.forEach(lane => {
      const checkbox = document.getElementById(`lane_${lane}`);
      if (checkbox) checkbox.checked = true;
    });
    
    this.elements.entryStart.value = entry.start;
    this.elements.entryEnd.value = entry.end;
    this.elements.entryActivity.value = entry.activity;
    this.updateActivityPreview();
    
    // Set edit mode
    this.currentEditId = index;
    this.elements.formTitle.textContent = 'Edit Schedule Entry';
    this.elements.submitBtn.textContent = 'Update Entry';
    
    // Open modal
    this.elements.formModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Delete an entry
   */
  deleteEntry(date, index) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    this.pendingSchedules[date].splice(index, 1);
    
    // Clean up empty dates
    if (this.pendingSchedules[date].length === 0) {
      delete this.pendingSchedules[date];
    }
    
    this.showToast('Entry deleted', 'success');
    this.updatePreview();
  }

  /**
   * Clear all entries for a day
   */
  clearDay() {
    const date = this.elements.previewDate.value;
    if (!this.pendingSchedules[date] || this.pendingSchedules[date].length === 0) {
      this.showToast('No entries to clear', 'error');
      return;
    }
    
    if (!confirm(`Clear all ${this.pendingSchedules[date].length} entries for this day?`)) return;
    
    delete this.pendingSchedules[date];
    this.showToast('Day cleared', 'success');
    this.updatePreview();
  }

  /**
   * Export schedule to JSON file
   */
  exportSchedule() {
    const exportData = {
      ...this.schedule.data,
      schedules: this.pendingSchedules
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-schedule-${this.formatDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('Schedule exported!', 'success');
  }

  /**
   * Import schedule from JSON file
   */
  async importSchedule(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.schedules) {
        throw new Error('Invalid schedule file');
      }
      
      if (!confirm('This will replace your current schedule. Continue?')) return;
      
      this.pendingSchedules = data.schedules;
      this.showToast('Schedule imported successfully!', 'success');
      this.updatePreview();
      
    } catch (error) {
      console.error('Import error:', error);
      this.showToast('Failed to import file. Make sure it\'s valid JSON.', 'error');
    }
    
    // Reset file input
    this.elements.importFile.value = '';
  }

  /**
   * Toggle JSON preview
   */
  toggleJsonPreview() {
    const preview = this.elements.jsonPreview;
    
    if (preview.style.display === 'none') {
      const exportData = {
        ...this.schedule.data,
        schedules: this.pendingSchedules
      };
      this.elements.jsonCode.textContent = JSON.stringify(exportData, null, 2);
      preview.style.display = 'block';
      this.elements.previewJsonBtn.textContent = '👁️ Hide JSON';
    } else {
      preview.style.display = 'none';
      this.elements.previewJsonBtn.textContent = '👁️ Preview JSON';
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'success') {
    const toast = this.elements.toast;
    const toastMessage = this.elements.toastMessage;
    
    toast.classList.remove('toast--success', 'toast--error');
    toast.classList.add(`toast--${type}`);
    toastMessage.textContent = message;
    toast.classList.add('toast--visible');
    
    setTimeout(() => {
      toast.classList.remove('toast--visible');
    }, 3000);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format time for display (HH:MM to h:MM AM/PM)
   */
  formatTime(time) {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  // ==========================================
  // View Toggle Methods
  // ==========================================
  
  setupViewToggle() {
    if (!this.elements.viewToggle) return;
    
    const buttons = this.elements.viewToggle.querySelectorAll('.view-toggle__btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchView(btn.dataset.view);
      });
    });
    
    // Setup grid filter buttons
    if (this.elements.gridQuickFilterOpenSwim) {
      this.elements.gridQuickFilterOpenSwim.addEventListener('click', () => {
        this.selectOpenSwimFilter();
        this.renderGridView();
        this.updateGridQuickFilterButtons();
        this.updateGridLegendStates();
      });
    }
    if (this.elements.gridQuickFilterShowAll) {
      this.elements.gridQuickFilterShowAll.addEventListener('click', () => {
        this.clearFilters();
        this.renderGridView();
        this.updateGridQuickFilterButtons();
        this.updateGridLegendStates();
      });
    }
    
    // Clear filter button
    if (this.elements.gridClearFilterBtn) {
      this.elements.gridClearFilterBtn.addEventListener('click', () => {
        this.clearFilters();
        this.renderGridView();
        this.updateGridQuickFilterButtons();
        this.updateGridLegendStates();
        this.updateGridFilterUI();
      });
    }
    
    // Expand/collapse toggle
    if (this.elements.gridLegendToggle) {
      this.elements.gridLegendToggle.addEventListener('click', () => {
        this.toggleGridLegend();
      });
    }
    
    // Grid date navigation
    if (this.elements.gridPrevDay) {
      this.elements.gridPrevDay.addEventListener('click', () => this.navigateGridDay(-1));
    }
    if (this.elements.gridNextDay) {
      this.elements.gridNextDay.addEventListener('click', () => this.navigateGridDay(1));
    }
    
    // Grid date picker
    if (this.elements.gridDatePickerBtn) {
      this.elements.gridDatePickerBtn.addEventListener('click', () => this.toggleGridDatePicker());
    }
    if (this.elements.gridPrevMonth) {
      this.elements.gridPrevMonth.addEventListener('click', () => this.navigateGridMonth(-1));
    }
    if (this.elements.gridNextMonth) {
      this.elements.gridNextMonth.addEventListener('click', () => this.navigateGridMonth(1));
    }
    
    // Close date picker when clicking outside
    document.addEventListener('click', (e) => {
      if (this.elements.gridDatePicker && 
          !this.elements.gridDatePicker.contains(e.target) && 
          !this.elements.gridDatePickerBtn?.contains(e.target)) {
        this.closeGridDatePicker();
      }
    });
    
    // Now button - go to today
    if (this.elements.gridBtnNow) {
      this.elements.gridBtnNow.addEventListener('click', () => {
        const today = this.formatDate(new Date());
        this.elements.previewDate.value = today;
        this.updatePreview(); // Update list view too
        this.renderGridView();
      });
    }
    
    // Start clock for grid view
    this.startGridClock();
  }
  
  startGridClock() {
    this.updateGridClock();
    this.clockInterval = setInterval(() => this.updateGridClock(), 1000);
  }
  
  updateGridClock() {
    if (this.elements.gridTimeDisplay) {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      this.elements.gridTimeDisplay.textContent = `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
  }
  
  navigateGridDay(direction) {
    const currentDate = new Date(this.elements.previewDate.value + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() + direction);
    const newDateStr = this.formatDate(currentDate);
    this.elements.previewDate.value = newDateStr;
    this.updatePreview(); // Update list view too
    this.renderGridView();
  }
  
  toggleGridDatePicker() {
    if (this.gridDatePickerOpen) {
      this.closeGridDatePicker();
    } else {
      this.openGridDatePicker();
    }
  }
  
  openGridDatePicker() {
    this.pickerMonth = new Date(this.elements.previewDate.value + 'T12:00:00');
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
  
  navigateGridMonth(direction) {
    this.pickerMonth.setMonth(this.pickerMonth.getMonth() + direction);
    this.renderGridDatePicker();
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
    const selectedDate = this.elements.previewDate.value;
    
    const btn = document.createElement('button');
    btn.className = 'date-picker__day';
    btn.textContent = date.getDate();
    
    if (isOtherMonth) btn.classList.add('date-picker__day--other-month');
    if (dateStr === todayStr) btn.classList.add('date-picker__day--today');
    if (dateStr === selectedDate) btn.classList.add('date-picker__day--selected');
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.elements.previewDate.value = dateStr;
      this.closeGridDatePicker();
      this.updatePreview(); // Update list view too
      this.renderGridView();
    });
    
    return btn;
  }
  
  switchView(view) {
    if (this.currentView === view) return;
    this.currentView = view;
    
    // Update toggle button states
    const buttons = this.elements.viewToggle.querySelectorAll('.view-toggle__btn');
    buttons.forEach(btn => {
      btn.classList.toggle('view-toggle__btn--active', btn.dataset.view === view);
    });
    
    // Show/hide views
    if (view === 'list') {
      this.elements.listView.style.display = '';
      this.elements.gridView.style.display = 'none';
    } else if (view === 'grid') {
      this.elements.listView.style.display = 'none';
      this.elements.gridView.style.display = 'block';
      this.renderGridView();
    }
  }
  
  // ==========================================
  // Grid View Methods
  // ==========================================
  
  renderGridView() {
    const table = this.elements.scheduleGrid;
    if (!table) return;
    
    const date = this.elements.previewDate.value;
    const hours = this.schedule.getPoolHours(date);
    
    // Update date label
    if (this.elements.gridDateLabel) {
      const dateObj = new Date(date + 'T12:00:00');
      this.elements.gridDateLabel.textContent = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
    
    if (!hours) {
      table.innerHTML = '<tr><td style="padding: 40px; text-align: center; color: var(--text-muted);">No schedule data available for this date.</td></tr>';
      return;
    }
    
    const layout = this.schedule.getPoolLayout();
    const sections = layout?.sections || [];
    const timeSlots = this.generateTimeSlots(hours.open, hours.close, 30);
    
    let html = '';
    
    // Header Row 1: Pool Section Names
    html += '<thead>';
    html += '<tr>';
    html += '<th class="schedule-grid__section-header" rowspan="2">Time</th>';
    
    sections.forEach((section, index) => {
      const sectionClass = this.getSectionHeaderClass(section.id, index);
      html += `<th class="schedule-grid__section-header ${sectionClass}" colspan="${section.lanes.length}">${section.name}</th>`;
    });
    html += '</tr>';
    
    // Header Row 2: Lane Numbers
    html += '<tr>';
    sections.forEach(section => {
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
    timeSlots.forEach(slot => {
      html += `<tr data-time="${slot.minutes}">`;
      html += `<td class="schedule-grid__time">${slot.label}</td>`;
      
      sections.forEach(section => {
        section.lanes.forEach((lane, laneIndex) => {
          const laneId = this.parseLaneId(lane);
          const status = this.schedule.getLaneStatus(date, section.id, laneId, slot.minutes);
          const isLastLane = laneIndex === section.lanes.length - 1;
          
          let cellClass = 'schedule-grid__cell';
          if (isLastLane) cellClass += ' schedule-grid__cell--section-end';
          let cellStyle = '';
          
          if (status && status.activity) {
            const activity = status.activity;
            const isMatch = this.isActivityMatchingFilter(activity.id);
            
            cellClass += ' schedule-grid__cell--activity';
            if (this.activeFilters.length > 0 && !isMatch) {
              cellClass += ' schedule-grid__cell--dimmed';
            }
            cellStyle = `background-color: ${activity.color};`;
          } else {
            cellClass += ' schedule-grid__cell--closed';
          }
          
          html += `<td class="${cellClass}" style="${cellStyle}" data-section="${section.id}" data-lane="${lane}" data-time="${slot.minutes}"></td>`;
        });
      });
      
      html += '</tr>';
    });
    html += '</tbody>';
    
    table.innerHTML = html;
    
    // Add row hover handlers
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      row.addEventListener('mouseenter', () => row.classList.add('schedule-grid__row--hover'));
      row.addEventListener('mouseleave', () => row.classList.remove('schedule-grid__row--hover'));
    });
    
    // Add tooltip handlers for all cells
    this.setupGridCellTooltips();
  }
  
  setupGridCellTooltips() {
    const allCells = this.elements.scheduleGrid.querySelectorAll('.schedule-grid__cell');
    allCells.forEach(cell => {
      cell.addEventListener('mouseenter', (e) => this.startGridCellTooltip(e, cell));
      cell.addEventListener('mousemove', (e) => {
        if (this.elements.laneTooltip && this.elements.laneTooltip.classList.contains('lane-tooltip--visible')) {
          this.positionTooltip(e);
        }
        this.lastTooltipEvent = e;
      });
      cell.addEventListener('mouseleave', () => this.cancelGridCellTooltip());
    });
  }
  
  startGridCellTooltip(e, cell) {
    this.lastTooltipEvent = e;
    this.pendingTooltipCell = cell;
    
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
    }
    
    this.tooltipTimer = setTimeout(() => {
      if (this.pendingTooltipCell === cell) {
        this.showGridCellTooltip(this.lastTooltipEvent, cell);
      }
    }, 500);
  }
  
  cancelGridCellTooltip() {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    this.pendingTooltipCell = null;
    this.hideTooltip();
  }
  
  showGridCellTooltip(e, cell) {
    const sectionId = cell.dataset.section;
    const lane = cell.dataset.lane;
    const timeMinutes = parseInt(cell.dataset.time, 10);
    const date = this.elements.previewDate.value;
    
    const layout = this.schedule.getPoolLayout();
    const section = layout?.sections?.find(s => s.id === sectionId);
    const sectionName = section?.name || sectionId;
    
    const laneId = this.parseLaneId(lane);
    const status = this.schedule.getLaneStatus(date, sectionId, laneId, timeMinutes);
    
    let html = '';
    
    if (status && status.activity) {
      const activity = status.activity;
      html = `
        <div class="lane-tooltip__activity">
          <span class="lane-tooltip__activity-dot" style="background: ${activity.color}"></span>
          ${activity.name}
        </div>
        <div class="lane-tooltip__time">${this.formatTime(status.entry.start)} - ${this.formatTime(status.entry.end)}</div>
        <div class="lane-tooltip__location">${sectionName} - Lane ${lane}</div>
      `;
    } else {
      html = `
        <div class="lane-tooltip__no-match">Closed / No activity</div>
        <div class="lane-tooltip__location">${sectionName} - Lane ${lane}</div>
      `;
    }
    
    if (this.elements.laneTooltipContent) {
      this.elements.laneTooltipContent.innerHTML = html;
    }
    if (this.elements.laneTooltip) {
      this.elements.laneTooltip.classList.add('lane-tooltip--visible');
    }
    this.positionTooltip(e);
  }
  
  positionTooltip(e) {
    if (!this.elements.laneTooltip) return;
    
    const tooltip = this.elements.laneTooltip;
    const offset = 15;
    
    let x = e.clientX + offset;
    let y = e.clientY + offset;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (x + tooltipRect.width > viewportWidth - 10) {
      x = e.clientX - tooltipRect.width - offset;
    }
    if (y + tooltipRect.height > viewportHeight - 10) {
      y = e.clientY - tooltipRect.height - offset;
    }
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  
  hideTooltip() {
    if (this.elements.laneTooltip) {
      this.elements.laneTooltip.classList.remove('lane-tooltip--visible');
    }
  }
  
  toggleGridLegend() {
    if (this.elements.gridLegendSidebar) {
      this.elements.gridLegendSidebar.classList.toggle('legend-sidebar--hidden');
    }
    if (this.elements.gridLegendToggle) {
      this.elements.gridLegendToggle.classList.toggle('legend-toggle--collapsed');
    }
    if (this.elements.gridView) {
      this.elements.gridView.classList.toggle('admin-grid-view--expanded');
    }
  }
  
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
  
  getSectionHeaderClass(sectionId, index) {
    const isOddSection = index % 2 === 1;
    let cls = isOddSection ? 'schedule-grid__section-header--alt' : '';
    
    const classMap = {
      'therapy': 'schedule-grid__section-header--therapy',
      'instructional': 'schedule-grid__section-header--instructional',
      'shallow': 'schedule-grid__section-header--shallow',
      'main': 'schedule-grid__section-header--main',
      'deep': 'schedule-grid__section-header--deep',
      'deep_south': 'schedule-grid__section-header--deep-well',
      'deep_north': 'schedule-grid__section-header--deep-well'
    };
    
    if (classMap[sectionId]) {
      cls += ' ' + classMap[sectionId];
    }
    return cls;
  }
  
  parseLaneId(lane) {
    const num = parseInt(lane, 10);
    return isNaN(num) ? lane : num;
  }
  
  isActivityMatchingFilter(activityId) {
    if (this.activeFilters.length === 0) return true;
    
    for (const filter of this.activeFilters) {
      if (filter.type === 'activity' && filter.id === activityId) return true;
      if (filter.type === 'category' && filter.activityIds?.includes(activityId)) return true;
    }
    return false;
  }
  
  selectOpenSwimFilter() {
    const categories = this.schedule.getCategories();
    const openSwimCategory = categories.find(cat => cat.id === 'open');
    
    if (openSwimCategory) {
      const activityIds = this.schedule.getActivitiesByCategory(openSwimCategory.id).map(a => a.id);
      this.activeFilters = [{
        type: 'category',
        id: openSwimCategory.id,
        name: openSwimCategory.name,
        activityIds: activityIds
      }];
      this.openSwimQuickMode = true;
    }
  }
  
  clearFilters() {
    this.activeFilters = [];
    this.openSwimQuickMode = false;
  }
  
  updateGridQuickFilterButtons() {
    const isOpenSwimActive = this.openSwimQuickMode;
    const isAllActive = this.activeFilters.length === 0 || !this.openSwimQuickMode;
    
    if (this.elements.gridQuickFilterOpenSwim) {
      this.elements.gridQuickFilterOpenSwim.classList.toggle('quick-view-toggle__btn--active', isOpenSwimActive);
    }
    if (this.elements.gridQuickFilterShowAll) {
      this.elements.gridQuickFilterShowAll.classList.toggle('quick-view-toggle__btn--active', isAllActive && !isOpenSwimActive);
    }
  }
  
  renderGridLegend() {
    const container = this.elements.gridLegendGrid;
    if (!container) return;
    
    container.innerHTML = '';
    
    const activities = this.schedule.getActivities();
    const categories = this.schedule.getActivityCategories();
    
    // Store category groups for filtering
    this.categoryGroups = {};
    categories.forEach(cat => {
      this.categoryGroups[cat.id] = {
        name: cat.name,
        activities: activities.filter(a => a.category === cat.id)
      };
    });
    
    categories.forEach(cat => {
      const categoryActivities = activities.filter(a => a.category === cat.id);
      if (categoryActivities.length === 0) return;
      
      const card = document.createElement('div');
      card.className = 'legend-category-card';
      card.dataset.category = cat.id;
      
      const header = document.createElement('div');
      header.className = 'legend-category__header';
      header.innerHTML = `
        <span class="legend-category__title">${cat.name}</span>
        <span class="legend-category__count">${categoryActivities.length}</span>
      `;
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCategoryFilter(cat.id);
      });
      card.appendChild(header);
      
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'legend-category__items';
      
      categoryActivities.forEach(activity => {
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
    
    this.updateGridLegendStates();
  }
  
  toggleActivityFilter(activityId) {
    this.openSwimQuickMode = false;
    
    const existingIndex = this.activeFilters.findIndex(
      f => f.type === 'activity' && f.id === activityId
    );
    
    if (existingIndex !== -1) {
      this.activeFilters.splice(existingIndex, 1);
    } else {
      const activity = this.schedule.getActivity(activityId);
      this.activeFilters.push({ 
        type: 'activity', 
        id: activityId, 
        name: activity.name 
      });
    }
    
    this.renderGridView();
    this.updateGridLegendStates();
    this.updateGridFilterUI();
    this.updateGridQuickFilterButtons();
  }
  
  toggleCategoryFilter(categoryId) {
    this.openSwimQuickMode = false;
    
    const existingIndex = this.activeFilters.findIndex(
      f => f.type === 'category' && f.id === categoryId
    );
    
    if (existingIndex !== -1) {
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
    
    this.renderGridView();
    this.updateGridLegendStates();
    this.updateGridFilterUI();
    this.updateGridQuickFilterButtons();
  }
  
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
  
  updateGridFilterUI() {
    if (this.activeFilters.length > 0) {
      if (this.elements.gridClearFilterBtn) {
        this.elements.gridClearFilterBtn.classList.remove('legend-sidebar__clear-btn--hidden');
      }
    } else {
      if (this.elements.gridClearFilterBtn) {
        this.elements.gridClearFilterBtn.classList.add('legend-sidebar__clear-btn--hidden');
      }
    }
  }
}

// Initialize admin panel
const adminPanel = new AdminPanel();
document.addEventListener('DOMContentLoaded', () => {
  adminPanel.init();
});


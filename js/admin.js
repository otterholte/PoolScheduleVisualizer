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
      todayBtn: document.getElementById('todayBtn'),
      clearDayBtn: document.getElementById('clearDayBtn'),
      scheduleList: document.getElementById('scheduleList'),
      exportBtn: document.getElementById('exportBtn'),
      importFile: document.getElementById('importFile'),
      previewJsonBtn: document.getElementById('previewJsonBtn'),
      jsonPreview: document.getElementById('jsonPreview'),
      jsonCode: document.getElementById('jsonCode'),
      toast: document.getElementById('toast'),
      toastMessage: document.getElementById('toastMessage'),
      quickTimeButtons: document.getElementById('quickTimeButtons')
    };
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
    
    // Preview date change
    this.elements.previewDate.addEventListener('change', () => {
      this.updatePreview();
    });
    
    // Today button
    this.elements.todayBtn.addEventListener('click', () => {
      const today = this.formatDate(new Date());
      this.elements.previewDate.value = today;
      this.elements.entryDate.value = today;
      this.updatePreview();
    });
    
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
}

// Initialize admin panel
const adminPanel = new AdminPanel();
document.addEventListener('DOMContentLoaded', () => {
  adminPanel.init();
});


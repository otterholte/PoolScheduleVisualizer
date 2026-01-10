/**
 * Pool Diagram Renderer
 * Creates and updates the visual pool representation
 */

class PoolDiagram {
  constructor(containerId, scheduleManager) {
    this.container = document.getElementById(containerId);
    this.schedule = scheduleManager;
    this.selectedDate = null;
    this.selectedTime = null;
    this.activeFilter = null;
    this.onLaneClick = null;
  }

  /**
   * Initialize the pool diagram
   */
  init() {
    this.render();
  }

  /**
   * Render the full pool layout
   */
  render() {
    const layout = this.schedule.getPoolLayout();
    if (!layout) {
      this.container.innerHTML = '<p class="text-center">Unable to load pool layout</p>';
      return;
    }

    this.container.innerHTML = '';

    layout.sections.forEach(section => {
      const sectionEl = this.createSection(section);
      this.container.appendChild(sectionEl);
    });
  }

  /**
   * Create a pool section element
   */
  createSection(section) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'pool-section';
    sectionEl.dataset.sectionId = section.id;

    // Section header
    const header = document.createElement('div');
    header.className = 'pool-section__header';
    header.textContent = section.name;
    sectionEl.appendChild(header);

    // Lanes container
    const lanesContainer = document.createElement('div');
    lanesContainer.className = 'pool-section__lanes';

    section.lanes.forEach(lane => {
      const laneEl = this.createLane(section.id, lane);
      lanesContainer.appendChild(laneEl);
    });

    sectionEl.appendChild(lanesContainer);
    return sectionEl;
  }

  /**
   * Create a lane element
   */
  createLane(sectionId, lane) {
    const laneEl = document.createElement('div');
    laneEl.className = 'lane';
    laneEl.dataset.section = sectionId;
    laneEl.dataset.lane = lane;

    // Lane number label
    const numberEl = document.createElement('span');
    numberEl.className = 'lane__number';
    numberEl.textContent = lane;
    laneEl.appendChild(numberEl);

    // Activity overlay
    const activityEl = document.createElement('div');
    activityEl.className = 'lane__activity';
    
    const activityName = document.createElement('span');
    activityName.className = 'lane__activity-name';
    activityEl.appendChild(activityName);
    
    laneEl.appendChild(activityEl);

    // Click handler
    laneEl.addEventListener('click', () => {
      if (this.onLaneClick) {
        this.onLaneClick(sectionId, lane);
      }
    });

    return laneEl;
  }

  /**
   * Update lane statuses based on current time and date
   */
  update(dateStr, timeMinutes) {
    this.selectedDate = dateStr;
    this.selectedTime = timeMinutes;

    const lanes = this.container.querySelectorAll('.lane');
    
    lanes.forEach(laneEl => {
      const sectionId = laneEl.dataset.section;
      const lane = this.parseLaneId(laneEl.dataset.lane);
      
      const status = this.schedule.getLaneStatus(dateStr, sectionId, lane, timeMinutes);
      this.updateLaneVisual(laneEl, status);
    });
  }

  /**
   * Update visual appearance of a single lane
   */
  updateLaneVisual(laneEl, status) {
    const activityEl = laneEl.querySelector('.lane__activity');
    const activityNameEl = laneEl.querySelector('.lane__activity-name');

    // Reset classes
    laneEl.classList.remove('lane--open', 'lane--occupied', 'lane--closed', 'lane--filtered');

    if (!status) {
      // No activity at this time - could be closed or unscheduled
      laneEl.classList.add('lane--closed');
      activityEl.style.background = '#94a3b8';
      activityNameEl.textContent = 'Unavailable';
      return;
    }

    const activity = status.activity;
    
    if (activity.id === 'open_lap') {
      laneEl.classList.add('lane--open');
    } else if (activity.id === 'closed') {
      laneEl.classList.add('lane--closed');
    } else {
      laneEl.classList.add('lane--occupied');
    }

    activityEl.style.background = activity.color;
    activityNameEl.textContent = activity.shortName || activity.name;

    // Apply filter highlighting
    if (this.activeFilter) {
      if (activity.id === this.activeFilter) {
        laneEl.classList.add('lane--filtered');
        laneEl.style.transform = 'scale(1.05)';
        laneEl.style.boxShadow = `0 0 20px ${activity.color}80`;
      } else {
        laneEl.style.opacity = '0.4';
        laneEl.style.transform = '';
        laneEl.style.boxShadow = '';
      }
    } else {
      laneEl.style.opacity = '';
      laneEl.style.transform = '';
      laneEl.style.boxShadow = '';
    }
  }

  /**
   * Set activity filter
   */
  setFilter(activityId) {
    this.activeFilter = activityId;
    if (this.selectedDate && this.selectedTime !== null) {
      this.update(this.selectedDate, this.selectedTime);
    }
  }

  /**
   * Clear activity filter
   */
  clearFilter() {
    this.activeFilter = null;
    if (this.selectedDate && this.selectedTime !== null) {
      this.update(this.selectedDate, this.selectedTime);
    }
  }

  /**
   * Parse lane ID (could be number or string)
   */
  parseLaneId(lane) {
    const num = parseInt(lane, 10);
    return isNaN(num) ? lane : num;
  }
}


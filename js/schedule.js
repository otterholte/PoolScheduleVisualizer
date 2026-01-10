/**
 * Schedule Data Manager
 * Handles loading and querying schedule data
 */

class ScheduleManager {
  constructor() {
    this.data = null;
    this.activities = new Map();
    this.sections = new Map();
  }

  /**
   * Load schedule data from JSON file
   */
  async load() {
    try {
      const response = await fetch('data/schedule.json');
      if (!response.ok) throw new Error('Failed to load schedule');
      
      this.data = await response.json();
      
      // Index activities for quick lookup
      this.data.activities.forEach(activity => {
        this.activities.set(activity.id, activity);
      });
      
      // Index sections for quick lookup
      this.data.poolLayout.sections.forEach(section => {
        this.sections.set(section.id, section);
      });
      
      return this.data;
    } catch (error) {
      console.error('Error loading schedule:', error);
      throw error;
    }
  }

  /**
   * Get pool layout configuration
   */
  getPoolLayout() {
    return this.data?.poolLayout || null;
  }

  /**
   * Get all activities
   */
  getActivities() {
    return this.data?.activities || [];
  }

  /**
   * Get activity categories
   */
  getActivityCategories() {
    return this.data?.activityCategories || [];
  }

  /**
   * Get activity by ID
   */
  getActivity(id) {
    return this.activities.get(id);
  }

  /**
   * Get section by ID
   */
  getSection(id) {
    return this.sections.get(id);
  }

  /**
   * Get schedule for a specific date
   * @param {string} dateStr - Date in YYYY-MM-DD format
   */
  getScheduleForDate(dateStr) {
    return this.data?.schedules?.[dateStr] || [];
  }

  /**
   * Get all available dates in the schedule
   */
  getAvailableDates() {
    return Object.keys(this.data?.schedules || {}).sort();
  }

  /**
   * Get lane status at a specific time
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @param {string} sectionId - Pool section ID
   * @param {string|number} lane - Lane identifier
   * @param {number} timeMinutes - Time in minutes from midnight
   */
  getLaneStatus(dateStr, sectionId, lane, timeMinutes) {
    const schedule = this.getScheduleForDate(dateStr);
    
    for (const entry of schedule) {
      if (entry.section !== sectionId) continue;
      if (!entry.lanes.includes(lane)) continue;
      
      const startMinutes = this.timeToMinutes(entry.start);
      const endMinutes = this.timeToMinutes(entry.end);
      
      if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
        return {
          activity: this.getActivity(entry.activity),
          entry: entry
        };
      }
    }
    
    return null;
  }

  /**
   * Get full day schedule for a specific lane
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @param {string} sectionId - Pool section ID
   * @param {string|number} lane - Lane identifier
   */
  getLaneSchedule(dateStr, sectionId, lane) {
    const schedule = this.getScheduleForDate(dateStr);
    const laneSchedule = [];
    
    for (const entry of schedule) {
      if (entry.section !== sectionId) continue;
      if (!entry.lanes.includes(lane)) continue;
      
      laneSchedule.push({
        ...entry,
        activity: this.getActivity(entry.activity)
      });
    }
    
    // Sort by start time
    laneSchedule.sort((a, b) => {
      return this.timeToMinutes(a.start) - this.timeToMinutes(b.start);
    });
    
    return laneSchedule;
  }

  /**
   * Get all activities occurring at a specific time
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @param {number} timeMinutes - Time in minutes from midnight
   */
  getActivitiesAtTime(dateStr, timeMinutes) {
    const schedule = this.getScheduleForDate(dateStr);
    const activeActivities = new Set();
    
    for (const entry of schedule) {
      const startMinutes = this.timeToMinutes(entry.start);
      const endMinutes = this.timeToMinutes(entry.end);
      
      if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
        activeActivities.add(entry.activity);
      }
    }
    
    return Array.from(activeActivities).map(id => this.getActivity(id));
  }

  /**
   * Find all time slots for a specific activity
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @param {string} activityId - Activity ID
   */
  findActivitySlots(dateStr, activityId) {
    const schedule = this.getScheduleForDate(dateStr);
    return schedule.filter(entry => entry.activity === activityId);
  }

  /**
   * Get pool hours for a specific date
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {object} { open: minutes, close: minutes } or null if not found
   */
  getPoolHours(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay();
    
    let hours;
    if (dayOfWeek === 0) {
      hours = this.data?.facilityInfo?.hours?.sunday;
    } else if (dayOfWeek === 6) {
      hours = this.data?.facilityInfo?.hours?.saturday;
    } else {
      hours = this.data?.facilityInfo?.hours?.weekday;
    }
    
    if (!hours) return null;
    
    return {
      open: this.timeToMinutes(hours.open),
      close: this.timeToMinutes(hours.close)
    };
  }

  /**
   * Check if pool is open at a given time
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @param {number} timeMinutes - Time in minutes from midnight
   */
  isPoolOpen(dateStr, timeMinutes) {
    const hours = this.getPoolHours(dateStr);
    if (!hours) return false;
    return timeMinutes >= hours.open && timeMinutes < hours.close;
  }

  /**
   * Convert time string (HH:MM) to minutes from midnight
   */
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes from midnight to time string (HH:MM AM/PM)
   */
  minutesToTimeString(minutes, format12h = true) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (!format12h) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  }
}

// Export singleton instance
const scheduleManager = new ScheduleManager();


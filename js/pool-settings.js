/**
 * Pool Settings - Layout Builder
 * Clean, minimal visual builder for pool layouts
 */

class PoolSettingsBuilder {
  constructor() {
    this.facilitySlug = new URLSearchParams(window.location.search).get('facility') || 'demo';
    this.data = null;
    this.elements = [];
    this.selectedElement = null;
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.resizeHandle = null;
    this.undoStack = [];
    this.redoStack = [];
    this.editingActivityId = null;
    this.editingPoolName = false;
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.renderElements();
    this.renderActivities();
    this.renderPoolsList();
    this.populateFacilityInfo();
    this.updateTitle();
  }

  async loadData() {
    try {
      const response = await fetch(`/api/facility/${this.facilitySlug}`);
      if (!response.ok) throw new Error('Facility not found');
      this.data = await response.json();
      
      // Extract elements from poolLayout
      if (this.data.poolLayout?.elements) {
        this.elements = this.data.poolLayout.elements.map(el => ({
          ...el,
          id: el.id || this.generateId()
        }));
      }
    } catch (error) {
      console.error('Failed to load facility data:', error);
      this.showToast('Failed to load facility data', true);
      // Initialize with empty data
      this.data = {
        facilityInfo: { name: 'New Facility', hours: {} },
        poolLayout: { sections: [], elements: [] },
        activities: [],
        activityCategories: [],
        schedules: {}
      };
      this.elements = [];
    }
  }

  setupEventListeners() {
    // Toolbar dropdowns
    document.querySelectorAll('.toolbar-dropdown__trigger').forEach(btn => {
      btn.addEventListener('click', (e) => this.toggleDropdown(e.currentTarget.parentElement));
    });

    // Dropdown items - add elements
    document.querySelectorAll('.toolbar-dropdown__item').forEach(item => {
      item.addEventListener('click', () => this.addElementFromDropdown(item));
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.toolbar-dropdown')) {
        document.querySelectorAll('.toolbar-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    });

    // Canvas interactions
    const canvas = document.getElementById('canvas');
    canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());

    // Click outside to deselect and close popover
    document.addEventListener('click', (e) => {
      // Never deselect if clicking on an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      const clickedOnElement = e.target.closest('.canvas-element');
      const clickedOnPopover = e.target.closest('.selection-popover');
      const clickedOnCanvas = e.target.closest('.canvas');
      const clickedOnPoolItem = e.target.closest('.pool-item');
      const clickedOnInfoSection = e.target.closest('.info-section');
      const clickedOnToolbar = e.target.closest('.toolbar');
      
      // If clicking inside canvas but NOT on an element, deselect
      if (clickedOnCanvas && !clickedOnElement) {
        this.deselectElement();
        return;
      }
      
      // Deselect if clicking outside all interactive areas
      if (this.selectedElement && !clickedOnElement && !clickedOnPopover && !clickedOnCanvas && !clickedOnPoolItem && !clickedOnInfoSection && !clickedOnToolbar) {
        this.deselectElement();
      }
    });

    // Tabs
    document.querySelectorAll('.info-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Facility info inputs
    document.getElementById('inputFacilityName').addEventListener('input', (e) => {
      this.data.facilityInfo.name = e.target.value;
      this.updateTitle();
    });

    document.getElementById('inputSlug').addEventListener('input', (e) => {
      this.data.facilityInfo.slug = e.target.value;
    });

    // Hours inputs
    ['Weekday', 'Saturday', 'Sunday'].forEach(day => {
      const key = day.toLowerCase();
      document.getElementById(`input${day}Open`).addEventListener('change', (e) => {
        if (!this.data.facilityInfo.hours[key]) this.data.facilityInfo.hours[key] = {};
        this.data.facilityInfo.hours[key].open = e.target.value;
      });
      document.getElementById(`input${day}Close`).addEventListener('change', (e) => {
        if (!this.data.facilityInfo.hours[key]) this.data.facilityInfo.hours[key] = {};
        this.data.facilityInfo.hours[key].close = e.target.value;
      });
    });

    // Save button
    document.getElementById('btnSave').addEventListener('click', () => this.saveData());

    // Undo/Redo
    document.getElementById('btnUndo').addEventListener('click', () => this.undo());
    document.getElementById('btnRedo').addEventListener('click', () => this.redo());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && this.selectedElement) {
        this.deleteSelectedElement();
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        this.redo();
      }
    });

    // Selection popover
    document.getElementById('popoverName').addEventListener('input', (e) => {
      if (this.selectedElement) {
        this.selectedElement.name = e.target.value;
        this.renderElements();
        this.renderPoolsList();
      }
    });

    document.getElementById('popoverDelete').addEventListener('click', () => {
      this.deleteSelectedElement();
    });

    // Activity modal
    document.getElementById('btnAddActivity').addEventListener('click', () => this.openActivityModal());
    document.getElementById('closeActivityModal').addEventListener('click', () => this.closeActivityModal());
    document.getElementById('cancelActivityBtn').addEventListener('click', () => this.closeActivityModal());
    document.getElementById('activityForm').addEventListener('submit', (e) => this.saveActivity(e));
    document.getElementById('deleteActivityBtn').addEventListener('click', () => this.deleteActivity());

    // Quick add activity chips
    document.querySelectorAll('.quick-add__chip').forEach(chip => {
      chip.addEventListener('click', () => this.quickAddActivity(chip));
    });

    // Color picker sync
    document.getElementById('activityColor').addEventListener('input', (e) => {
      document.getElementById('activityColorHex').value = e.target.value;
    });
    document.getElementById('activityColorHex').addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        document.getElementById('activityColor').value = val;
      }
    });

    // Close modal on overlay click
    document.getElementById('activityModal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeActivityModal();
      }
    });
  }

  toggleDropdown(dropdown) {
    const isOpen = dropdown.classList.contains('open');
    // Close all dropdowns
    document.querySelectorAll('.toolbar-dropdown.open').forEach(d => d.classList.remove('open'));
    // Toggle current
    if (!isOpen) {
      dropdown.classList.add('open');
    }
  }

  addElementFromDropdown(item) {
    const type = item.dataset.type;
    const shape = item.dataset.shape;
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    
    // Default sizes based on type
    let width = 150, height = 100;
    if (type === 'amenity') {
      width = 80;
      height = 80;
    } else if (type === 'facility') {
      width = 120;
      height = 80;
    }
    if (shape === 'round' || shape === 'hot-tub') {
      height = width;
    }

    // Center position
    const x = (rect.width / 2) - (width / 2);
    const y = (rect.height / 2) - (height / 2);

    const element = {
      id: this.generateId(),
      type,
      shape,
      name: item.querySelector('span').textContent,
      x,
      y,
      width,
      height,
      lanes: (type === 'pool' && shape === 'rectangle') ? 6 : undefined
    };

    this.saveState();
    this.elements.push(element);
    this.renderElements();
    this.renderPoolsList();
    this.selectElement(element.id);

    // Close dropdown
    item.closest('.toolbar-dropdown').classList.remove('open');
  }

  onCanvasMouseDown(e) {
    const elementEl = e.target.closest('.canvas-element');
    const resizeHandle = e.target.closest('.resize-handle');
    
    if (resizeHandle && this.selectedElement) {
      this.isResizing = true;
      this.resizeHandle = resizeHandle.className.split('--')[1];
      this.saveState();
      e.preventDefault();
      return;
    }

    if (elementEl) {
      const id = elementEl.dataset.id;
      const element = this.elements.find(el => el.id === id);
      
      if (element) {
        // Calculate offset BEFORE selecting (which re-renders DOM)
        const canvasRect = document.getElementById('canvas').getBoundingClientRect();
        const clickX = e.clientX - canvasRect.left;
        const clickY = e.clientY - canvasRect.top;
        
        // Store offset from element's top-left corner
        this.dragOffset = {
          x: clickX - element.x,
          y: clickY - element.y
        };
        
        this.selectElement(id);
        this.isDragging = true;
        this.saveState();
      }
      e.preventDefault();
    }
  }

  onMouseMove(e) {
    if (!this.selectedElement) return;

    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    if (this.isDragging) {
      const newX = Math.max(0, Math.min(canvasRect.width - this.selectedElement.width, mouseX - this.dragOffset.x));
      const newY = Math.max(0, Math.min(canvasRect.height - this.selectedElement.height, mouseY - this.dragOffset.y));
      
      // Snap to grid (20px)
      this.selectedElement.x = Math.round(newX / 20) * 20;
      this.selectedElement.y = Math.round(newY / 20) * 20;
      
      this.renderElements();
      this.updatePopoverPosition();
    }

    if (this.isResizing) {
      const el = this.selectedElement;
      const minSize = 40;

      switch (this.resizeHandle) {
        case 'e':
          el.width = Math.max(minSize, Math.round((mouseX - el.x) / 20) * 20);
          break;
        case 'w':
          const newW = el.x + el.width - mouseX;
          if (newW >= minSize) {
            el.width = Math.round(newW / 20) * 20;
            el.x = Math.round(mouseX / 20) * 20;
          }
          break;
        case 's':
          el.height = Math.max(minSize, Math.round((mouseY - el.y) / 20) * 20);
          break;
        case 'n':
          const newH = el.y + el.height - mouseY;
          if (newH >= minSize) {
            el.height = Math.round(newH / 20) * 20;
            el.y = Math.round(mouseY / 20) * 20;
          }
          break;
        case 'se':
          el.width = Math.max(minSize, Math.round((mouseX - el.x) / 20) * 20);
          el.height = Math.max(minSize, Math.round((mouseY - el.y) / 20) * 20);
          break;
        case 'sw':
          const newWsw = el.x + el.width - mouseX;
          if (newWsw >= minSize) {
            el.width = Math.round(newWsw / 20) * 20;
            el.x = Math.round(mouseX / 20) * 20;
          }
          el.height = Math.max(minSize, Math.round((mouseY - el.y) / 20) * 20);
          break;
        case 'ne':
          el.width = Math.max(minSize, Math.round((mouseX - el.x) / 20) * 20);
          const newHne = el.y + el.height - mouseY;
          if (newHne >= minSize) {
            el.height = Math.round(newHne / 20) * 20;
            el.y = Math.round(mouseY / 20) * 20;
          }
          break;
        case 'nw':
          const newWnw = el.x + el.width - mouseX;
          const newHnw = el.y + el.height - mouseY;
          if (newWnw >= minSize) {
            el.width = Math.round(newWnw / 20) * 20;
            el.x = Math.round(mouseX / 20) * 20;
          }
          if (newHnw >= minSize) {
            el.height = Math.round(newHnw / 20) * 20;
            el.y = Math.round(mouseY / 20) * 20;
          }
          break;
      }

      this.renderElements();
      this.updatePopoverPosition();
    }
  }

  onMouseUp() {
    if (this.isDragging || this.isResizing) {
      this.isDragging = false;
      this.isResizing = false;
      this.resizeHandle = null;
      // Only update pool list if we actually moved/resized something
      this.updatePoolsListSelection();
    }
  }

  selectElement(id) {
    // Don't do anything if already selected
    if (this.selectedElement?.id === id) return;
    
    this.selectedElement = this.elements.find(el => el.id === id);
    this.renderElements();
    this.showPopover();
    this.updatePoolsListSelection();
  }

  deselectElement() {
    if (!this.selectedElement) return;
    this.selectedElement = null;
    this.renderElements();
    this.hidePopover();
    this.updatePoolsListSelection();
  }
  
  // Update selection state without re-rendering the entire list
  updatePoolsListSelection() {
    const container = document.getElementById('poolsList');
    if (!container) return;
    
    container.querySelectorAll('.pool-item').forEach(item => {
      if (item.dataset.id === this.selectedElement?.id) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  deleteSelectedElement() {
    if (!this.selectedElement) return;
    this.saveState();
    this.elements = this.elements.filter(el => el.id !== this.selectedElement.id);
    this.deselectElement();
    this.renderElements();
    this.renderPoolsList();
  }

  showPopover() {
    if (!this.selectedElement) return;
    
    const popover = document.getElementById('selectionPopover');
    const nameInput = document.getElementById('popoverName');
    const body = document.getElementById('popoverBody');
    
    nameInput.value = this.selectedElement.name || '';
    
    // Build popover body based on element type
    let bodyHTML = '';
    
    if (this.selectedElement.type === 'pool' && this.selectedElement.shape === 'rectangle') {
      bodyHTML = `
        <div class="popover-field">
          <span class="popover-field__label">Lanes</span>
          <input type="number" class="popover-field__input" id="popoverLanes" 
                 value="${this.selectedElement.lanes || 6}" min="1" max="12">
        </div>
      `;
    }
    
    bodyHTML += `
      <div class="popover-field">
        <span class="popover-field__label">Width</span>
        <input type="number" class="popover-field__input" id="popoverWidth" 
               value="${Math.round(this.selectedElement.width)}" step="20">
      </div>
      <div class="popover-field">
        <span class="popover-field__label">Height</span>
        <input type="number" class="popover-field__input" id="popoverHeight" 
               value="${Math.round(this.selectedElement.height)}" step="20">
      </div>
    `;
    
    body.innerHTML = bodyHTML;
    
    // Add listeners
    const lanesInput = document.getElementById('popoverLanes');
    if (lanesInput) {
      lanesInput.addEventListener('input', (e) => {
        this.selectedElement.lanes = parseInt(e.target.value) || 6;
        this.renderElements();
        this.renderPoolsList();
      });
    }
    
    document.getElementById('popoverWidth').addEventListener('input', (e) => {
      this.selectedElement.width = parseInt(e.target.value) || 100;
      this.renderElements();
    });
    
    document.getElementById('popoverHeight').addEventListener('input', (e) => {
      this.selectedElement.height = parseInt(e.target.value) || 100;
      this.renderElements();
    });
    
    popover.classList.add('visible');
    this.updatePopoverPosition();
  }

  hidePopover() {
    document.getElementById('selectionPopover').classList.remove('visible');
  }

  updatePopoverPosition() {
    if (!this.selectedElement) return;
    
    const popover = document.getElementById('selectionPopover');
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    const elRight = canvasRect.left + this.selectedElement.x + this.selectedElement.width;
    const elBottom = canvasRect.top + this.selectedElement.y + this.selectedElement.height;
    
    // Position to the right of the element
    let left = elRight + 12;
    let top = canvasRect.top + this.selectedElement.y;
    
    // If it would go off screen, position to the left
    if (left + 240 > window.innerWidth) {
      left = canvasRect.left + this.selectedElement.x - 240 - 12;
    }
    
    // Keep within viewport
    top = Math.max(80, Math.min(window.innerHeight - 200, top));
    
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  renderElements() {
    const container = document.getElementById('canvasElements');
    container.innerHTML = this.elements.map(el => this.renderElement(el)).join('');
  }

  renderElement(el) {
    const isSelected = this.selectedElement?.id === el.id;
    let lanesHtml = '';
    
    if (el.type === 'pool' && el.shape === 'rectangle' && el.lanes) {
      lanesHtml = `
        <div class="canvas-element__lanes">
          ${Array(el.lanes).fill('<div class="canvas-element__lane"></div>').join('')}
        </div>
      `;
    }
    
    const handles = isSelected ? `
      <div class="resize-handle resize-handle--nw"></div>
      <div class="resize-handle resize-handle--n"></div>
      <div class="resize-handle resize-handle--ne"></div>
      <div class="resize-handle resize-handle--e"></div>
      <div class="resize-handle resize-handle--se"></div>
      <div class="resize-handle resize-handle--s"></div>
      <div class="resize-handle resize-handle--sw"></div>
      <div class="resize-handle resize-handle--w"></div>
    ` : '';
    
    return `
      <div class="canvas-element ${isSelected ? 'selected' : ''}"
           data-id="${el.id}"
           data-type="${el.type}"
           data-shape="${el.shape}"
           style="left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px;">
        ${lanesHtml}
        <span class="canvas-element__label">${el.name || el.shape}</span>
        ${handles}
      </div>
    `;
  }

  renderPoolsList() {
    const container = document.getElementById('poolsList');
    
    if (this.elements.length === 0) {
      container.innerHTML = `<p class="pools-list__empty">No pools added yet. Use the toolbar above to add pools and other elements.</p>`;
      return;
    }
    
    container.innerHTML = this.elements.map(el => {
      const isSelected = this.selectedElement?.id === el.id;
      const showLanes = el.type === 'pool' && el.shape === 'rectangle';
      
      // Icon based on type/shape
      let iconSvg = '';
      if (el.type === 'pool') {
        iconSvg = `<svg viewBox="0 0 32 24"><rect x="2" y="4" width="28" height="16" rx="2" fill="#0ea5e9"/></svg>`;
        if (el.shape === 'round') {
          iconSvg = `<svg viewBox="0 0 32 24"><circle cx="16" cy="12" r="10" fill="#0ea5e9"/></svg>`;
        } else if (el.shape === 'kidney') {
          iconSvg = `<svg viewBox="0 0 32 24"><ellipse cx="16" cy="12" rx="13" ry="9" fill="#0ea5e9"/></svg>`;
        } else if (el.shape === 'lazy-river') {
          iconSvg = `<svg viewBox="0 0 32 24"><ellipse cx="16" cy="12" rx="12" ry="8" fill="none" stroke="#0ea5e9" stroke-width="4"/></svg>`;
        }
      } else if (el.type === 'amenity') {
        iconSvg = `<svg viewBox="0 0 32 24"><circle cx="16" cy="12" r="9" fill="#14b8a6"/></svg>`;
      } else {
        iconSvg = `<svg viewBox="0 0 32 24"><rect x="4" y="6" width="24" height="12" rx="2" fill="#64748b"/></svg>`;
      }
      
      return `
        <div class="pool-item ${isSelected ? 'selected' : ''}" data-id="${el.id}">
          <div class="pool-item__icon">${iconSvg}</div>
          <div class="pool-item__info">
            <input type="text" class="pool-item__name-input" value="${el.name || el.shape}" data-id="${el.id}" placeholder="Enter name">
            <div class="pool-item__type">${el.type} &bull; ${el.shape}</div>
          </div>
          ${showLanes ? `
            <div class="pool-item__lanes">
              <label>Lanes:</label>
              <input type="number" value="${el.lanes || 6}" min="1" max="12" data-id="${el.id}">
            </div>
          ` : ''}
          <button class="pool-item__delete" data-id="${el.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');
    
    // Add click listeners for pool items (not inputs)
    container.querySelectorAll('.pool-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't select if clicking on delete button or any input
        if (e.target.closest('.pool-item__delete') || e.target.tagName === 'INPUT') {
          return;
        }
        this.selectElement(item.dataset.id);
      });
    });
    
    // Name input listeners - simple approach
    container.querySelectorAll('.pool-item__name-input').forEach(input => {
      // Update on blur
      input.addEventListener('change', (e) => {
        const el = this.elements.find(x => x.id === e.target.dataset.id);
        if (el) {
          el.name = e.target.value;
          this.renderElements();
          if (this.selectedElement?.id === el.id) {
            document.getElementById('popoverName').value = e.target.value;
          }
        }
      });
      
      // Live update canvas label as user types
      input.addEventListener('input', (e) => {
        const el = this.elements.find(x => x.id === e.target.dataset.id);
        if (el) {
          el.name = e.target.value;
          const canvasEl = document.querySelector(`.canvas-element[data-id="${el.id}"] .element-label`);
          if (canvasEl) {
            canvasEl.textContent = e.target.value || el.shape;
          }
        }
      });
    });
    
    container.querySelectorAll('.pool-item__lanes input').forEach(input => {
      input.addEventListener('input', (e) => {
        const el = this.elements.find(x => x.id === e.target.dataset.id);
        if (el) {
          el.lanes = parseInt(e.target.value) || 6;
          this.renderElements();
        }
      });
    });
    
    container.querySelectorAll('.pool-item__delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.saveState();
        this.elements = this.elements.filter(el => el.id !== id);
        if (this.selectedElement?.id === id) {
          this.deselectElement();
        }
        this.renderElements();
        this.renderPoolsList();
      });
    });
  }

  renderActivities() {
    const container = document.getElementById('activitiesGrid');
    const countEl = document.getElementById('activitiesCount');
    const activities = this.data.activities || [];
    
    countEl.textContent = `${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}`;
    
    if (activities.length === 0) {
      container.innerHTML = `<p style="color: var(--ps-text-dim); grid-column: 1/-1;">No activities yet. Click "Add Activity" to create one.</p>`;
      return;
    }
    
    container.innerHTML = activities.map(act => `
      <div class="activity-card" data-id="${act.id}">
        <div class="activity-card__swatch" style="background: ${act.color}"></div>
        <span class="activity-card__name">${act.name}</span>
        <span class="activity-card__short">${act.shortName || ''}</span>
      </div>
    `).join('');
    
    container.querySelectorAll('.activity-card').forEach(card => {
      card.addEventListener('click', () => this.openActivityModal(card.dataset.id));
    });
  }

  openActivityModal(activityId = null) {
    const modal = document.getElementById('activityModal');
    const title = document.getElementById('activityModalTitle');
    const deleteBtn = document.getElementById('deleteActivityBtn');
    
    this.editingActivityId = activityId;
    
    if (activityId) {
      const activity = this.data.activities.find(a => a.id === activityId);
      if (activity) {
        title.textContent = 'Edit Activity';
        document.getElementById('activityNameInput').value = activity.name;
        document.getElementById('activityShortName').value = activity.shortName || '';
        document.getElementById('activityColor').value = activity.color;
        document.getElementById('activityColorHex').value = activity.color;
        document.getElementById('activityCategory').value = activity.category || 'open';
        deleteBtn.style.display = 'block';
      }
    } else {
      title.textContent = 'Add Activity';
      document.getElementById('activityNameInput').value = '';
      document.getElementById('activityShortName').value = '';
      document.getElementById('activityColor').value = '#22c55e';
      document.getElementById('activityColorHex').value = '#22c55e';
      document.getElementById('activityCategory').value = 'open';
      deleteBtn.style.display = 'none';
    }
    
    modal.classList.add('visible');
  }

  closeActivityModal() {
    document.getElementById('activityModal').classList.remove('visible');
    this.editingActivityId = null;
  }

  saveActivity(e) {
    e.preventDefault();
    
    const name = document.getElementById('activityNameInput').value.trim();
    const shortName = document.getElementById('activityShortName').value.trim();
    const color = document.getElementById('activityColor').value;
    const category = document.getElementById('activityCategory').value;
    
    if (!name) return;
    
    if (!this.data.activities) this.data.activities = [];
    
    if (this.editingActivityId) {
      const activity = this.data.activities.find(a => a.id === this.editingActivityId);
      if (activity) {
        activity.name = name;
        activity.shortName = shortName;
        activity.color = color;
        activity.category = category;
      }
    } else {
      this.data.activities.push({
        id: this.generateId(),
        name,
        shortName,
        color,
        category
      });
    }
    
    this.renderActivities();
    this.closeActivityModal();
  }

  deleteActivity() {
    if (!this.editingActivityId) return;
    this.data.activities = this.data.activities.filter(a => a.id !== this.editingActivityId);
    this.renderActivities();
    this.closeActivityModal();
  }

  quickAddActivity(chip) {
    const name = chip.dataset.name;
    const shortName = chip.dataset.short;
    const color = chip.dataset.color;
    const category = chip.dataset.category;
    
    // Check if activity already exists
    if (!this.data.activities) this.data.activities = [];
    const exists = this.data.activities.some(a => a.name.toLowerCase() === name.toLowerCase());
    
    if (exists) {
      this.showToast(`"${name}" already exists`, true);
      return;
    }
    
    this.data.activities.push({
      id: this.generateId(),
      name,
      shortName,
      color,
      category
    });
    
    this.renderActivities();
    this.showToast(`Added "${name}"`);
  }

  switchTab(tabId) {
    document.querySelectorAll('.info-tab').forEach(t => t.classList.remove('info-tab--active'));
    document.querySelectorAll('.info-panel').forEach(p => p.classList.remove('info-panel--active'));
    
    document.querySelector(`.info-tab[data-tab="${tabId}"]`).classList.add('info-tab--active');
    document.getElementById(`panel-${tabId}`).classList.add('info-panel--active');
  }

  populateFacilityInfo() {
    const info = this.data.facilityInfo || {};
    const hours = info.hours || {};
    
    document.getElementById('inputFacilityName').value = info.name || '';
    document.getElementById('inputSlug').value = info.slug || this.facilitySlug;
    
    document.getElementById('inputWeekdayOpen').value = hours.weekday?.open || '06:00';
    document.getElementById('inputWeekdayClose').value = hours.weekday?.close || '21:00';
    document.getElementById('inputSaturdayOpen').value = hours.saturday?.open || '08:00';
    document.getElementById('inputSaturdayClose').value = hours.saturday?.close || '20:00';
    document.getElementById('inputSundayOpen').value = hours.sunday?.open || '09:00';
    document.getElementById('inputSundayClose').value = hours.sunday?.close || '18:00';
  }

  updateTitle() {
    const title = document.getElementById('facilityTitle');
    title.textContent = this.data.facilityInfo?.name || 'Pool Layout Builder';
  }

  async saveData() {
    // Update poolLayout.elements
    this.data.poolLayout = this.data.poolLayout || {};
    this.data.poolLayout.elements = this.elements;
    
    // Update sections from pools
    this.data.poolLayout.sections = this.elements
      .filter(el => el.type === 'pool')
      .map(el => ({
        id: el.id,
        name: el.name || el.shape,
        lanes: el.shape === 'rectangle' && el.lanes 
          ? Array.from({ length: el.lanes }, (_, i) => i + 1)
          : []
      }));
    
    try {
      const response = await fetch(`/api/save-facility/${this.facilitySlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.data)
      });
      
      if (!response.ok) throw new Error('Failed to save');
      this.showToast('Saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      this.showToast('Failed to save', true);
    }
  }

  saveState() {
    // Save current state for undo
    this.undoStack.push(JSON.stringify(this.elements));
    this.redoStack = [];
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.elements));
    this.elements = JSON.parse(this.undoStack.pop());
    this.deselectElement();
    this.renderElements();
    this.renderPoolsList();
    this.updateUndoRedoButtons();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.elements));
    this.elements = JSON.parse(this.redoStack.pop());
    this.deselectElement();
    this.renderElements();
    this.renderPoolsList();
    this.updateUndoRedoButtons();
  }

  updateUndoRedoButtons() {
    document.getElementById('btnUndo').disabled = this.undoStack.length === 0;
    document.getElementById('btnRedo').disabled = this.redoStack.length === 0;
  }

  generateId() {
    return 'el_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toastMessage');
    
    messageEl.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('visible');
    
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.poolSettings = new PoolSettingsBuilder();
});

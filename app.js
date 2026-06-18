/* ==========================================================================
   Teample Hub Core JavaScript Logic
   ========================================================================== */

// 1. Preset colors for team members (beautiful pastel / vibrant theme colors)
const MEMBER_COLORS = [
  '#FF6B8B', // Pink
  '#FFB800', // Yellow
  '#3A86FF', // Blue
  '#9C27B0', // Purple
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#00BFA5', // Teal
  '#FF5E7E'  // Coral
];

// 2. Global State Structure
let state = {
  members: [],
  roles: []
};

// Current editing state for schedule drag selection
let currentScheduleEditor = 'heatmap'; // 'heatmap' or memberId
let tempSchedule = []; // 2D array [7][15] representing temporary schedule editing state
let isDragging = false;
let dragValue = 1; // 1 for selecting, 0 for deselecting

// Hour grid parameters (09:00 ~ 24:00 = 15 hours)
const START_HOUR = 9;
const TOTAL_HOURS = 15;
const DAYS_KOREAN = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

// Default roles template
const DEFAULT_ROLES = [
  { category: '문서', title: '👑 조장 & 총괄', tasks: [{ id: 't1', text: '회의 일정 조율 및 진행', checked: false }, { id: 't2', text: '최종 결과물 검토 및 제출', checked: false }] },
  { category: '개발', title: '🔍 자료 조사', tasks: [{ id: 't3', text: '주제 관련 논문 및 통계 조사', checked: false }, { id: 't4', text: '조사 자료 핵심 요약 공유', checked: false }] },
  { category: '디자인', title: '🎨 발표 자료 제작 (PPT)', tasks: [{ id: 't5', text: '발표 슬라이드 레이아웃 디자인', checked: false }, { id: 't6', text: '자료 시각화 (인포그래픽/도표)', checked: false }] },
  { category: '발표', title: '🎙️ 발표 진행', tasks: [{ id: 't7', text: '발표 스크립트 작성', checked: false }, { id: 't8', text: '발표 리허설 및 Q&A 준비', checked: false }] },
  { category: '문서', title: '📝 회의록 기록 & 서기', tasks: [{ id: 't9', text: '회의록 작성 및 공유', checked: false }, { id: 't10', text: '팀플 드라이브 파일 정리', checked: false }] }
];

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderMembers();
  renderRoles();
  initTimetableGrid();
  renderHeatmapOrSchedule();
  renderRecommendations();
  renderStatusList();
  updateSummaryText();
  
  // Attach global mouseup to end drag selection anywhere
  window.addEventListener('mouseup', () => {
    isDragging = false;
  });
});

/* ==========================================================================
   Data Management & LocalStorage
   ========================================================================== */
function loadData() {
  const savedData = localStorage.getItem('teample_hub_data');
  if (savedData) {
    try {
      state = JSON.parse(savedData);
      
      // Migration: Ensure all members have capability scores
      state.members.forEach(member => {
        if (member.coding_score === undefined) {
          member.coding_score = Math.floor(Math.random() * 10) + 1;
          member.presentation_score = Math.floor(Math.random() * 10) + 1;
          member.design_score = Math.floor(Math.random() * 10) + 1;
          member.documentation_score = Math.floor(Math.random() * 10) + 1;
        }
      });
      
      // Migration: Ensure roles have categories where possible
      state.roles.forEach(role => {
        if (!role.category) {
          const title = role.title;
          if (title.includes('개발') || title.includes('조사') || title.includes('구현')) role.category = '개발';
          else if (title.includes('발표') || title.includes('진행')) role.category = '발표';
          else if (title.includes('디자인') || title.includes('PPT') || title.includes('시각화') || title.includes('제작')) role.category = '디자인';
          else if (title.includes('문서') || title.includes('기록') || title.includes('서기') || title.includes('조장') || title.includes('총괄') || title.includes('리더')) role.category = '문서';
        }
      });
      
      saveData();
    } catch (e) {
      console.error('데이터 로드 실패, 초기화합니다.', e);
      initializeEmptyState();
    }
  } else {
    initializeEmptyState();
  }
}

function initializeEmptyState() {
  state = {
    members: [],
    roles: DEFAULT_ROLES.map((r, index) => ({
      id: `role_${Date.now()}_${index}`,
      category: r.category,
      title: r.title,
      assignedMemberId: '',
      tasks: r.tasks.map(t => ({ ...t, id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }))
    }))
  };
  saveData();
}

function saveData() {
  localStorage.setItem('teample_hub_data', JSON.stringify(state));
}

/* ==========================================================================
   Tab Navigation Logic
   ========================================================================== */
function switchTab(tabName) {
  // Toggle Content Blocks
  document.getElementById('tab-role').classList.remove('active');
  document.getElementById('tab-time').classList.remove('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Toggle Nav Buttons
  document.getElementById('tab-role-btn').classList.remove('active');
  document.getElementById('tab-time-btn').classList.remove('active');
  document.getElementById(`tab-${tabName}-btn`).classList.add('active');

  // Refresh layouts if needed
  if (tabName === 'time') {
    renderHeatmapOrSchedule();
    renderRecommendations();
    renderStatusList();
  }
}

/* ==========================================================================
   Team Members Logic
   ========================================================================== */
function addMember(event) {
  event.preventDefault();
  const nameInput = document.getElementById('member-name-input');
  const name = nameInput.value.trim();
  
  if (!name) return;
  
  // Check limit (e.g. max 10 members)
  if (state.members.length >= 10) {
    showToast('팀원은 최대 10명까지 추가할 수 있습니다. 🥺');
    return;
  }

  // Check duplicate name
  if (state.members.some(m => m.name === name)) {
    showToast('이미 존재하는 팀원 이름입니다! 😮');
    return;
  }

  // Get next color from palette
  const colorIndex = state.members.length % MEMBER_COLORS.length;
  const newMember = {
    id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: name,
    color: MEMBER_COLORS[colorIndex],
    coding_score: Math.floor(Math.random() * 10) + 1,
    presentation_score: Math.floor(Math.random() * 10) + 1,
    design_score: Math.floor(Math.random() * 10) + 1,
    documentation_score: Math.floor(Math.random() * 10) + 1,
    schedule: Array(7).fill(0).map(() => Array(TOTAL_HOURS).fill(0)) // 7 days x 15 hours of 0s (unavailable)
  };

  state.members.push(newMember);
  saveData();
  
  nameInput.value = '';
  
  // Update views
  renderMembers();
  updateMemberSelectors();
  renderStatusList();
  renderHeatmapOrSchedule();
  renderRecommendations();
  updateSummaryText();
  
  showToast(`${name} 팀원이 추가되었습니다. 🥳`);
}

function removeMember(memberId, name) {
  state.members = state.members.filter(m => m.id !== memberId);
  
  // Reset roles assigned to this member
  state.roles.forEach(role => {
    if (role.assignedMemberId === memberId) {
      role.assignedMemberId = '';
    }
  });

  saveData();
  
  // If we were editing this user's schedule, reset select mode to heatmap
  if (currentScheduleEditor === memberId) {
    currentScheduleEditor = 'heatmap';
    document.getElementById('schedule-selector').value = 'heatmap';
    toggleScheduleActions(false);
  }

  renderMembers();
  renderRoles();
  updateMemberSelectors();
  renderStatusList();
  renderHeatmapOrSchedule();
  renderRecommendations();
  updateSummaryText();

  showToast(`${name} 팀원이 제거되었습니다. 🥲`);
}

function renderMembers() {
  const container = document.getElementById('member-tags-container');
  const countSpan = document.getElementById('member-count');
  
  // Clear tags except standard empty text
  container.innerHTML = '';
  
  countSpan.textContent = `${state.members.length}명`;

  if (state.members.length === 0) {
    container.innerHTML = `<p class="empty-text" id="empty-members-text">팀원을 추가하여 시작해 보세요! 🙋‍♀️🙋‍♂️</p>`;
    return;
  }

  state.members.forEach(member => {
    const tag = document.createElement('div');
    tag.className = 'member-tag';
    tag.style.backgroundColor = member.color;

    tag.innerHTML = `
      <span>${escapeHTML(member.name)}</span>
      <button class="btn-remove-tag" onclick="event.stopPropagation(); removeMember('${member.id}', '${escapeHTML(member.name)}')" aria-label="삭제">&times;</button>
    `;
    
    container.appendChild(tag);
  });
}

function recommendRole(member) {
  const scores = {
    "개발": member.coding_score || 0,
    "발표": member.presentation_score || 0,
    "디자인": member.design_score || 0,
    "문서": member.documentation_score || 0
  };
  return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
}

function autoDistributeRoles() {
  if (state.members.length === 0) {
    showToast('역할을 배정할 팀원이 없습니다. 팀원을 먼저 추가해 주세요! 👥');
    return;
  }
  
  // Clear previous assignments
  state.roles.forEach(role => {
    role.assignedMemberId = '';
  });

  const assignedMemberIds = new Set();

  // Greedy matching for each role
  state.roles.forEach(role => {
    let category = role.category;
    if (!category) {
      const title = role.title;
      if (title.includes('개발') || title.includes('조사') || title.includes('구현')) category = '개발';
      else if (title.includes('발표') || title.includes('진행')) category = '발표';
      else if (title.includes('디자인') || title.includes('PPT') || title.includes('시각화') || title.includes('제작')) category = '디자인';
      else if (title.includes('문서') || title.includes('기록') || title.includes('서기') || title.includes('조장') || title.includes('총괄') || title.includes('리더')) category = '문서';
    }

    if (!category) return;

    // Find the unassigned member with the highest score in this category
    let bestMember = null;
    let maxScore = -1;

    state.members.forEach(member => {
      if (assignedMemberIds.has(member.id)) return;
      
      let score = 0;
      if (category === '개발') score = member.coding_score;
      else if (category === '발표') score = member.presentation_score;
      else if (category === '디자인') score = member.design_score;
      else if (category === '문서') score = member.documentation_score;

      if (score > maxScore) {
        maxScore = score;
        bestMember = member;
      }
    });

    if (bestMember) {
      role.assignedMemberId = bestMember.id;
      assignedMemberIds.add(bestMember.id);
    }
  });

  saveData();
  renderRoles();
  updateSummaryText();
  showToast('🎲 역량 기반으로 최적의 역할이 자동 분배되었습니다!');
}

function updateMemberSelectors() {
  // Update the schedule viewer dropdown selector
  const selector = document.getElementById('schedule-selector');
  const currentValue = selector.value;
  
  // Reset selector options, keep Heatmap option
  selector.innerHTML = `<option value="heatmap">🔥 전체 팀원 시간표 (히트맵)</option>`;
  
  state.members.forEach(member => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = `🙋‍♂️ ${member.name} 시간표 입력`;
    selector.appendChild(option);
  });

  // Restore previous value if it still exists
  if (state.members.some(m => m.id === currentValue)) {
    selector.value = currentValue;
  } else {
    selector.value = 'heatmap';
    currentScheduleEditor = 'heatmap';
    toggleScheduleActions(false);
  }
}

/* ==========================================================================
   Roles & Tasks Management Logic
   ========================================================================== */
function createNewRoleCard() {
  const newRole = {
    id: `role_${Date.now()}`,
    title: '새 역할',
    assignedMemberId: '',
    tasks: []
  };

  state.roles.push(newRole);
  saveData();
  renderRoles();
  updateSummaryText();
  showToast('새 역할 카드가 추가되었습니다! 📌');
}

function deleteRole(roleId) {
  state.roles = state.roles.filter(r => r.id !== roleId);
  saveData();
  renderRoles();
  updateSummaryText();
  showToast('역할이 삭제되었습니다.');
}

function updateRoleTitle(roleId, title) {
  const role = state.roles.find(r => r.id === roleId);
  if (role) {
    role.title = title.trim() || '역할 이름 없음';
    saveData();
    updateSummaryText();
  }
}

function assignMemberToRole(roleId, memberId) {
  const role = state.roles.find(r => r.id === roleId);
  if (role) {
    role.assignedMemberId = memberId;
    saveData();
    
    // Rerender specifically to update card top borders or tags
    renderRoles();
    updateSummaryText();
    showToast('팀원이 배정되었습니다.');
  }
}

function addTaskToRole(roleId, inputId) {
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) return;

  const role = state.roles.find(r => r.id === roleId);
  if (role) {
    role.tasks.push({
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: text,
      checked: false
    });
    saveData();
    input.value = '';
    renderRoles();
    updateSummaryText();
  }
}

function toggleTask(roleId, taskId, checked) {
  const role = state.roles.find(r => r.id === roleId);
  if (role) {
    const task = role.tasks.find(t => t.id === taskId);
    if (task) {
      task.checked = checked;
      saveData();
      updateSummaryText();
    }
  }
}

function deleteTask(roleId, taskId) {
  const role = state.roles.find(r => r.id === roleId);
  if (role) {
    role.tasks = role.tasks.filter(t => t.id !== taskId);
    saveData();
    renderRoles();
    updateSummaryText();
  }
}

function renderRoles() {
  const container = document.getElementById('role-grid');
  container.innerHTML = '';

  if (state.roles.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
        <i data-lucide="award" style="width: 48px; height: 48px; color: var(--color-text-muted); margin-bottom: 12px;"></i>
        <p>추가된 역할이 없습니다. 상단의 '새 역할 추가' 버튼을 눌러보세요!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  state.roles.forEach((role, roleIndex) => {
    const card = document.createElement('div');
    card.className = `role-card card`;
    
    // Dynamic border color based on index or assigned member's color
    let assignedMember = state.members.find(m => m.id === role.assignedMemberId);
    if (assignedMember) {
      card.style.borderTopColor = assignedMember.color;
    } else {
      card.style.borderTopColor = MEMBER_COLORS[roleIndex % MEMBER_COLORS.length];
    }

    // Build Member Select Dropdown HTML
    let optionsHtml = `<option value="">👤 배정되지 않음</option>`;
    state.members.forEach(member => {
      const isSelected = member.id === role.assignedMemberId ? 'selected' : '';
      optionsHtml += `<option value="${member.id}" ${isSelected}>👤 ${escapeHTML(member.name)}</option>`;
    });

    // Build Tasks List HTML
    let tasksHtml = '';
    role.tasks.forEach(task => {
      const isChecked = task.checked ? 'checked' : '';
      tasksHtml += `
        <div class="task-item">
          <label class="task-label">
            <input type="checkbox" class="task-checkbox" ${isChecked} onchange="toggleTask('${role.id}', '${task.id}', this.checked)">
            <span>${escapeHTML(task.text)}</span>
          </label>
          <button class="btn-delete-task" onclick="deleteTask('${role.id}', '${task.id}')" aria-label="삭제">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      `;
    });

    const addTaskId = `add-task-input-${role.id}`;

    card.innerHTML = `
      <div class="role-card-header">
        <input type="text" class="role-title-input" value="${escapeHTML(role.title)}" 
               onblur="updateRoleTitle('${role.id}', this.value)" 
               onkeydown="if(event.key === 'Enter') { this.blur(); }">
        <button class="btn-delete-role" onclick="deleteRole('${role.id}')" title="역할 카드 삭제">
          <i data-lucide="x" style="width: 16px; height: 16px;"></i>
        </button>
      </div>

      <!-- Member Assignment dropdown -->
      <div class="custom-select-wrapper">
        <select onchange="assignMemberToRole('${role.id}', this.value)">
          ${optionsHtml}
        </select>
      </div>

      <!-- Checklist Section -->
      <div class="role-tasks-container">
        <div class="role-tasks-header">할 일 체크리스트 (${role.tasks.filter(t => t.checked).length}/${role.tasks.length})</div>
        <div class="role-tasks-list">
          ${tasksHtml || `<p class="empty-text" style="font-size: 0.8rem; text-align: left; padding: 6px;">할 일을 등록해 보세요!</p>`}
        </div>
      </div>

      <!-- Add Task input box -->
      <div class="add-task-form">
        <input type="text" id="${addTaskId}" placeholder="새 할 일..." 
               onkeydown="if(event.key === 'Enter') { addTaskToRole('${role.id}', '${addTaskId}'); event.preventDefault(); }">
        <button class="btn-add-task" onclick="addTaskToRole('${role.id}', '${addTaskId}')" aria-label="할 일 추가">
          <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Re-init icons inside card
  lucide.createIcons();
}

/* ==========================================================================
   Meeting Timetable & Heatmap Logic
   ========================================================================== */
function initTimetableGrid() {
  const timetable = document.getElementById('timetable');
  
  // Clear any dynamic cells (keep headers)
  const headerCount = 8; // "시간" header + 7 day headers
  while (timetable.children.length > headerCount) {
    timetable.removeChild(timetable.lastChild);
  }

  // Generate 15 rows (from 09:00 to 24:00)
  for (let hIndex = 0; hIndex < TOTAL_HOURS; hIndex++) {
    const currentHour = START_HOUR + hIndex;
    const startStr = String(currentHour).padStart(2, '0') + ':00';
    
    // 1. Time Indicator Column Cell
    const timeLabel = document.createElement('div');
    timeLabel.className = 'time-label-cell';
    timeLabel.textContent = startStr;
    timetable.appendChild(timeLabel);

    // 2. Monday to Sunday Cells
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const slot = document.createElement('div');
      slot.className = 'time-slot-cell';
      slot.dataset.day = dayIndex;
      slot.dataset.hourIndex = hIndex;

      // Event handlers for dragging selection
      slot.addEventListener('mousedown', (e) => {
        if (currentScheduleEditor === 'heatmap') return;
        isDragging = true;
        // Toggle cell availability
        dragValue = tempSchedule[dayIndex][hIndex] === 0 ? 1 : 0;
        tempSchedule[dayIndex][hIndex] = dragValue;
        updateCellVisualState(slot, dayIndex, hIndex);
        e.preventDefault();
      });

      slot.addEventListener('mouseenter', () => {
        if (!isDragging || currentScheduleEditor === 'heatmap') return;
        tempSchedule[dayIndex][hIndex] = dragValue;
        updateCellVisualState(slot, dayIndex, hIndex);
      });

      timetable.appendChild(slot);
    }
  }
}

// Update single cell color when editing schedule dynamically
function updateCellVisualState(slot, dayIndex, hIndex) {
  const isAvailable = tempSchedule[dayIndex][hIndex] === 1;
  const currentMember = state.members.find(m => m.id === currentScheduleEditor);
  
  if (isAvailable && currentMember) {
    slot.classList.add('slot-selected');
    slot.style.setProperty('--member-color', currentMember.color);
  } else {
    slot.classList.remove('slot-selected');
    slot.style.removeProperty('--member-color');
  }
}

function handleScheduleModeChange() {
  const selector = document.getElementById('schedule-selector');
  const value = selector.value;
  
  currentScheduleEditor = value;
  
  if (value === 'heatmap') {
    // Show Heatmap
    toggleScheduleActions(false);
    renderHeatmapOrSchedule();
    showToast('전체 팀원들의 시간표 히트맵을 보여줍니다.');
  } else {
    // Show individual editor
    const member = state.members.find(m => m.id === value);
    if (member) {
      // Load current member's schedule into temp memory
      tempSchedule = JSON.parse(JSON.stringify(member.schedule));
      toggleScheduleActions(true, member);
      renderHeatmapOrSchedule();
      showToast(`${member.name}님의 스케줄을 드래그하여 입력하세요.`);
    }
  }
}

function toggleScheduleActions(isEditing, member = null) {
  const actions = document.getElementById('timetable-actions');
  const resetBtn = document.getElementById('btn-reset-schedule');
  const saveBtn = document.getElementById('btn-save-schedule');
  const infoBox = document.getElementById('mode-info-box');

  if (isEditing && member) {
    resetBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'inline-flex';
    
    infoBox.innerHTML = `
      <span class="badge badge-pink" style="background-color: ${member.color}15; color: ${member.color}; border-color: ${member.color}35;">수정 모드</span>
      <p class="info-text"><b>${escapeHTML(member.name)}</b>님의 빈(가능한) 시간을 드래그해 칠한 뒤 저장해 주세요.</p>
    `;
  } else {
    resetBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    
    infoBox.innerHTML = `
      <span class="badge badge-yellow">히트맵 뷰</span>
      <p class="info-text">겹치는 시간이 많을수록 셀이 화사한 핑크-노란색으로 칠해집니다!</p>
    `;
  }
}

function resetCurrentSchedule() {
  if (currentScheduleEditor === 'heatmap') return;
  
  // Clear temp table
  tempSchedule = Array(7).fill(0).map(() => Array(TOTAL_HOURS).fill(0));
  
  // Reset styles of cells
  const cells = document.querySelectorAll('.time-slot-cell');
  cells.forEach(cell => {
    cell.classList.remove('slot-selected');
    cell.style.removeProperty('--member-color');
  });
  
  showToast('임시 입력된 일정이 비워졌습니다. (저장을 꼭 누르셔야 반영됩니다)');
}

function saveCurrentSchedule() {
  if (currentScheduleEditor === 'heatmap') return;
  
  const member = state.members.find(m => m.id === currentScheduleEditor);
  if (member) {
    // Commit temp schedule to state
    member.schedule = JSON.parse(JSON.stringify(tempSchedule));
    saveData();
    
    // Switch back to heatmap
    currentScheduleEditor = 'heatmap';
    document.getElementById('schedule-selector').value = 'heatmap';
    toggleScheduleActions(false);
    
    renderHeatmapOrSchedule();
    renderRecommendations();
    renderStatusList();
    updateSummaryText();
    
    showToast(`${member.name}님의 일정이 성공적으로 저장되었습니다! 👍`);
  }
}

function renderHeatmapOrSchedule() {
  const cells = document.querySelectorAll('.time-slot-cell');
  
  cells.forEach(cell => {
    const day = parseInt(cell.dataset.day);
    const hourIdx = parseInt(cell.dataset.hourIndex);
    
    // Clear styles/classes first
    cell.className = 'time-slot-cell';
    cell.style.removeProperty('--member-color');
    cell.innerHTML = ''; // Clear old tooltips
    
    if (currentScheduleEditor === 'heatmap') {
      // RENDERING HEATMAP VIEW
      if (state.members.length === 0) {
        cell.classList.add('heatmap-empty');
        return;
      }

      // Count overlap
      let availableMembers = [];
      state.members.forEach(member => {
        if (member.schedule && member.schedule[day] && member.schedule[day][hourIdx] === 1) {
          availableMembers.push(member);
        }
      });
      
      const count = availableMembers.length;
      const total = state.members.length;

      // Assign Heatmap Levels
      if (count === 0) {
        cell.classList.add('heatmap-empty');
      } else if (count === total && total > 1) {
        // Special full overlap level
        cell.classList.add('heatmap-level-5');
      } else {
        // Linear scale
        const ratio = count / total;
        if (ratio <= 0.25) cell.classList.add('heatmap-level-1');
        else if (ratio <= 0.5) cell.classList.add('heatmap-level-2');
        else if (ratio <= 0.75) cell.classList.add('heatmap-level-3');
        else cell.classList.add('heatmap-level-4');
      }

      // Add modern tooltip on hover
      const tooltip = document.createElement('span');
      tooltip.className = 'cell-tooltip';
      
      const timeStr = String(START_HOUR + hourIdx).padStart(2, '0') + ':00';
      if (count > 0) {
        const names = availableMembers.map(m => m.name).join(', ');
        tooltip.innerHTML = `<b>${DAYS_KOREAN[day]} ${timeStr}</b><br>${count}/${total}명 가능 (${names})`;
      } else {
        tooltip.innerHTML = `<b>${DAYS_KOREAN[day]} ${timeStr}</b><br>가능한 멤버 없음`;
      }
      cell.appendChild(tooltip);

    } else {
      // RENDERING USER SCHEDULING MODE
      const isAvailable = tempSchedule[day][hourIdx] === 1;
      const currentMember = state.members.find(m => m.id === currentScheduleEditor);
      
      if (isAvailable && currentMember) {
        cell.classList.add('slot-selected');
        cell.style.setProperty('--member-color', currentMember.color);
      }
    }
  });
}

/* ==========================================================================
   Recommendation System & Analytics
   ========================================================================== */
function renderRecommendations() {
  const container = document.getElementById('recommend-list');
  container.innerHTML = '';

  if (state.members.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>팀원 정보가 비어있습니다.<br>먼저 팀원을 추가해주세요! 🙋‍♀️</p>
      </div>
    `;
    return;
  }

  // 1. Calculate possible meeting slots.
  // Standard team meetings are usually 2 hours long.
  // Let's analyze all 2-hour blocks (consecutive hours: h and h+1) for all 7 days.
  const blocks = [];

  for (let day = 0; day < 7; day++) {
    for (let hIdx = 0; hIdx < TOTAL_HOURS - 1; hIdx++) {
      // Calculate intersection of members available at both hIdx and hIdx + 1
      const availableAtSlot1 = state.members.filter(m => m.schedule[day][hIdx] === 1);
      const availableAtSlot2 = state.members.filter(m => m.schedule[day][hIdx + 1] === 1);
      
      // Overlapping members who are available at BOTH hours
      const availableBoth = availableAtSlot1.filter(m1 => availableAtSlot2.some(m2 => m2.id === m1.id));
      const overlapCount = availableBoth.length;
      
      if (overlapCount > 0) {
        const absentMembers = state.members.filter(m => !availableBoth.some(ab => ab.id === m.id));
        blocks.push({
          day: day,
          startHour: START_HOUR + hIdx,
          endHour: START_HOUR + hIdx + 2,
          overlapCount: overlapCount,
          members: availableBoth,
          absent: absentMembers
        });
      }
    }
  }

  // 2. Rank blocks:
  // - High overlapCount first.
  // - Prefer weekend/weekdays? (Let's stick to simple ranking by headcount first, then by earliest day).
  blocks.sort((a, b) => {
    if (b.overlapCount !== a.overlapCount) {
      return b.overlapCount - a.overlapCount; // descending order of overlap count
    }
    // Tie-breaker: earliest weekday
    if (a.day !== b.day) return a.day - b.day;
    return a.startHour - b.startHour;
  });

  // Filter recommendations to avoid heavy overlap (e.g. recommend distinct time slots)
  // If we recommend Monday 14:00-16:00 and Monday 15:00-17:00, they are redundant.
  // Let's filter out blocks that overlap on the same day.
  const uniqueRecommendations = [];
  const coveredHours = Array(7).fill(0).map(() => Array(24).fill(false));

  for (const block of blocks) {
    if (uniqueRecommendations.length >= 3) break;

    // Check if this block overlaps with already recommended blocks on the same day
    let overlapsWithPrev = false;
    for (let h = block.startHour; h < block.endHour; h++) {
      if (coveredHours[block.day][h]) {
        overlapsWithPrev = true;
        break;
      }
    }

    if (!overlapsWithPrev) {
      uniqueRecommendations.push(block);
      // Mark hours as covered
      for (let h = block.startHour; h < block.endHour; h++) {
        coveredHours[block.day][h] = true;
      }
    }
  }

  // 3. Render Top 3
  if (uniqueRecommendations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>팀원들이 공통으로 가능한 시간대가 없습니다. 😢<br>개별 시간대를 더 많이 등록해 보시거나,<br>일부 조율이 필요합니다.</p>
      </div>
    `;
    return;
  }

  uniqueRecommendations.forEach((block, index) => {
    const item = document.createElement('div');
    item.className = 'recommend-item';
    
    const dayStr = DAYS_KOREAN[block.day];
    const startStr = String(block.startHour).padStart(2, '0') + ':00';
    const endStr = String(block.endHour).padStart(2, '0') + ':00';
    const totalCount = state.members.length;
    
    // Highlight perfect match
    const isPerfect = block.overlapCount === totalCount;
    const overlapPercentText = isPerfect ? '전원 참여 가능! 🔥' : `${block.overlapCount}/${totalCount}명 가능`;
    
    // Absentees detail
    let memberDetails = '';
    if (isPerfect) {
      memberDetails = '모든 조원이 시간 비움 완료!';
    } else {
      const names = block.members.map(m => m.name).join(', ');
      const absentNames = block.absent.map(m => m.name).join(', ');
      memberDetails = `참여: ${names} <span style="color: var(--color-text-muted)"> (미참여: ${absentNames})</span>`;
    }

    item.innerHTML = `
      <div class="recommend-rank rank-${index + 1}">${index + 1}</div>
      <div class="recommend-details">
        <div class="recommend-time">${dayStr} ${startStr} - ${endStr} (2시간)</div>
        <div class="recommend-overlap" style="${isPerfect ? 'color: var(--color-pink-accent); font-weight:800;' : ''}">
          ${overlapPercentText}
        </div>
        <div class="recommend-members">${memberDetails}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderStatusList() {
  const container = document.getElementById('status-list');
  container.innerHTML = '';

  if (state.members.length === 0) {
    container.innerHTML = `<p class="empty-text" style="font-size: 0.8rem;">등록된 팀원이 없습니다.</p>`;
    return;
  }

  state.members.forEach(member => {
    const item = document.createElement('div');
    item.className = 'status-item';
    
    // Check if schedule is not empty (has at least one '1')
    const hasInput = member.schedule.some(day => day.some(slot => slot === 1));
    
    const badgeClass = hasInput ? 'status-done' : 'status-pending';
    const badgeText = hasInput ? '입력 완료' : '미입력';
    const iconName = hasInput ? 'check-circle' : 'circle-ellipsis';

    item.innerHTML = `
      <div class="status-user-info">
        <span class="status-dot" style="background-color: ${member.color}"></span>
        <span>${escapeHTML(member.name)}</span>
      </div>
      <span class="status-badge ${badgeClass}">
        <i data-lucide="${iconName}"></i>
        <span>${badgeText}</span>
      </span>
    `;
    
    container.appendChild(item);
  });

  lucide.createIcons();
}

/* ==========================================================================
   Export / Summary Generation
   ========================================================================== */
function updateSummaryText() {
  const textarea = document.getElementById('summary-text');
  
  if (state.members.length === 0) {
    textarea.value = '팀원을 등록하고 시간과 역할을 배정하면, 이곳에 공유용 텍스트가 자동 생성됩니다! 💛💖';
    return;
  }

  let text = `📅 [Teample Hub] 팀플 역할 & 회의 시간 조율 결과 요약 📅\n`;
  text += `-------------------------------------------\n\n`;

  // 1. Members
  const memberNames = state.members.map(m => m.name).join(', ');
  text += `👥 팀원 목록: ${memberNames}\n\n`;

  // 2. Roles
  text += `📌 각 역할 분배 현황:\n`;
  if (state.roles.length === 0) {
    text += `  (배분된 역할이 없습니다.)\n`;
  } else {
    state.roles.forEach(role => {
      const member = state.members.find(m => m.id === role.assignedMemberId);
      const name = member ? member.name : '미배정 👥';
      const completedTasks = role.tasks.filter(t => t.checked).length;
      
      text += `  - ${role.title}: ${name} (${completedTasks}/${role.tasks.length} 완료)\n`;
      role.tasks.forEach(task => {
        const marker = task.checked ? '☑️' : '⏹️';
        text += `    ${marker} ${task.text}\n`;
      });
    });
  }
  text += `\n`;

  // 3. Recommended Meeting Time
  text += `✨ 추천 회의 시간 (2시간 기준):\n`;
  const blocks = [];
  for (let day = 0; day < 7; day++) {
    for (let hIdx = 0; hIdx < TOTAL_HOURS - 1; hIdx++) {
      const availS1 = state.members.filter(m => m.schedule[day][hIdx] === 1);
      const availS2 = state.members.filter(m => m.schedule[day][hIdx+1] === 1);
      const availableBoth = availS1.filter(m1 => availS2.some(m2 => m2.id === m1.id));
      
      if (availableBoth.length > 0) {
        const absents = state.members.filter(m => !availableBoth.some(ab => ab.id === m.id));
        blocks.push({
          day: day,
          startHour: START_HOUR + hIdx,
          endHour: START_HOUR + hIdx + 2,
          count: availableBoth.length,
          absent: absents
        });
      }
    }
  }

  // Filter overlapping slots to get top 3 distinct
  blocks.sort((a, b) => b.count - a.count || a.day - b.day || a.startHour - b.startHour);
  const top3 = [];
  const covered = Array(7).fill(0).map(() => Array(24).fill(false));
  
  for (const b of blocks) {
    if (top3.length >= 3) break;
    let overlap = false;
    for (let h = b.startHour; h < b.endHour; h++) {
      if (covered[b.day][h]) { overlap = true; break; }
    }
    if (!overlap) {
      top3.push(b);
      for (let h = b.startHour; h < b.endHour; h++) covered[b.day][h] = true;
    }
  }

  if (top3.length === 0) {
    text += `  (공통 가능한 시간대가 아직 없습니다. 시간표를 입력해주세요!)\n`;
  } else {
    top3.forEach((block, index) => {
      const dayStr = DAYS_KOREAN[block.day];
      const startStr = String(block.startHour).padStart(2, '0') + ':00';
      const endStr = String(block.endHour).padStart(2, '0') + ':00';
      const totalCount = state.members.length;
      
      if (block.count === totalCount) {
        text += `  ${index + 1}순위: ${dayStr} ${startStr} - ${endStr} (전원 가능! 🔥)\n`;
      } else {
        const absentNames = block.absent.map(m => m.name).join(', ');
        text += `  ${index + 1}순위: ${dayStr} ${startStr} - ${endStr} (${block.count}/${totalCount}명 가능 - 미참여: ${absentNames})\n`;
      }
    });
  }

  text += `\n-------------------------------------------\n`;
  text += `💡 Teample Hub에서 실시간으로 조율된 결과입니다. 💛💖`;
  
  textarea.value = text;
}

function copySummaryToClipboard() {
  const textarea = document.getElementById('summary-text');
  
  if (state.members.length === 0) {
    showToast('팀원과 회의 정보를 먼저 구성해주세요!');
    return;
  }

  textarea.select();
  textarea.setSelectionRange(0, 99999); // For mobile devices
  
  try {
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('회의 조율 결과가 클립보드에 복사되었습니다! 📋✨');
    }).catch(err => {
      // Fallback
      document.execCommand('copy');
      showToast('결과가 클립보드에 복사되었습니다! 📋✨');
    });
  } catch (err) {
    document.execCommand('copy');
    showToast('결과가 복사되었습니다!');
  }
}

/* ==========================================================================
   Toast Notification & Helper Utilities
   ========================================================================== */
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.textContent = message;
  toast.classList.add('show');
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

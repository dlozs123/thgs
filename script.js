// 数据变量
let characters = [];
let equipments = [];
let inheritValues = {};
let supabaseClient = null;

let currentSortColumn = null;
let currentSortDirection = 1;

// 加载数据
async function loadData() {
  try {
    const [configData, charData, equipData, inheritData] = await Promise.all([
      fetch('config.json').then(r => r.json()).catch(() => ({})),
      fetch('characters.json').then(r => r.json()).catch(() => []),
      fetch('equipments.json').then(r => r.json()),
      fetch('inherit.json').then(r => r.json())
    ]);
    
    if (configData.SUPABASE_URL && configData.SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(configData.SUPABASE_URL, configData.SUPABASE_ANON_KEY);
      
      const { data: dbChars, error } = await supabaseClient
        .from('characters')
        .select('*');

      if (!error && dbChars && dbChars.length > 0) {
        characters = dbChars.map(row => ({
          角色名: row.name,
          属性: row.attribute,
          面板: row.stats
        }));
      } else if (!error && dbChars && dbChars.length === 0 && charData.length > 0) {
        characters = charData;
        const uploadData = charData.map(c => ({
          name: c.角色名,
          attribute: c.属性,
          stats: c.面板
        }));
        await supabaseClient.from('characters').insert(uploadData);
      } else {
        characters = charData;
      }
    } else {
      characters = charData;
    }
    
    equipments = equipData;
    inheritValues = inheritData;
    
    // Add sort handlers to table headers
    document.querySelectorAll('#charTable th').forEach(th => {
      th.addEventListener('click', handleSortClick);
    });

    // 数据加载完成后初始化页面
    renderCharTable();
    renderEquipTable();
    initEquipInputs();
    initInheritSelects();
    calculateTotalPanel();
  } catch (error) {
    console.error('数据加载失败:', error);
  }
}

function handleSortClick(e) {
  const columnText = e.target.textContent;
  if(columnText === "等级") {
    currentSortColumn = null;
    currentSortDirection = 1;
  } else if(currentSortColumn === columnText) {
    currentSortDirection *= -1;
  } else {
    currentSortColumn = columnText;
    currentSortDirection = 1;
  }
  renderCharTable();
}

// 页面导航
function showPage(pageId) {
  document.querySelectorAll('.container').forEach(container => {
    container.style.display = 'none';
  });
  document.getElementById(pageId).style.display = 'block';
  scrollToTop();
}

// 拼音转换函数
function toPinyin(name) {
  const pinyinMap = {
    '灵': 'ling', '魔': 'mo', 'ç ': 'qi', '村': 'cun', '紫': 'zi',
    '铃': 'ling', '早': 'zao', '咲': 'xiao', '华': 'hua', '跹': 'he',
    '觉': 'jue', '文': 'wen', '妖': 'yao', '芙': 'fu', '蕾': 'lei', '布': 'bu',
    '帝': 'di', '翠': 'cui', '小': 'xiao', '爱': 'ai', '幽': 'you', '椛': 'hua',
    '勇': 'yong', '神': 'shen', '辉': 'hui', '蓝': 'lan', '恋': 'lian',
    '诹': 'zou', '白': 'bai', '永': 'yong', '影': 'ying', '屠': 'tu',
    '米': 'mi', '天': 'tian', '美': 'mei', '橙': 'cheng', '帕': 'pa',
    '燐': 'lin', '慧': 'hui', '针': 'zhen', '空': 'kong', '鬼': 'gui', '幽': 'you', '四': 'si'
  };
  let result = '';
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    result += pinyinMap[char] || char;
  }
  return result.toLowerCase();
}

// 角色数据库
let selectedCharacter = null;
let currentScale = 1;
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;

function renderCharTable() {
  const tbody = document.querySelector('#charTable tbody');
  tbody.innerHTML = '';

  const nameVal = document.getElementById('nameFilter').value.trim();
  const pinyinVal = document.getElementById('pinyinFilter').value.trim().toLowerCase();
  const attrVal = document.getElementById('attrFilter').value;
  const levelVal = document.getElementById('levelFilter').value;

  let rows = [];
  let rowCount = 0;
  
  const properties = ["体力", "护盾", "break", "灵力", "攻击力", "防御力", "灵击力", "技术", "充能", "运", "总面板"];
  const averages = {};

  if (levelVal) {
    properties.forEach(prop => {
      let sum = 0;
      let count = 0;
      characters.forEach(char => {
        if (char.面板[levelVal]) {
           const val = parseInt(char.面板[levelVal][prop]) || 0;
           if (val > 0) { sum += val; count++; }
        }
      });
      averages[prop] = count > 0 ? sum / count : 0;
    });
  }

  characters.forEach(char => {
    if (!char.面板[levelVal]) return;
    const panel = char.面板[levelVal];

    const pinyinName = toPinyin(char.角色名);

    if ((nameVal && !char.角色名.includes(nameVal)) ||
        (pinyinVal && !pinyinName.includes(pinyinVal)) ||
        (attrVal && char.属性 !== attrVal)) return;

    rows.push({
      角色名: char.角色名,
      属性: char.属性,
      等级: levelVal,
      ...panel
    });
    rowCount++;
  });

  if (currentSortColumn) {
    rows.sort((a, b) => {
      if (currentSortColumn === "角色名") {
        const pA = toPinyin(a.角色名);
        const pB = toPinyin(b.角色名);
        return currentSortDirection * pA.localeCompare(pB);
      } else if (currentSortColumn === "属性") {
        const attrCompare = a.属性.localeCompare(b.属性);
        if(attrCompare !== 0) return currentSortDirection * attrCompare;
        const pA = toPinyin(a.角色名);
        const pB = toPinyin(b.角色名);
        return pA.localeCompare(pB);
      } else {
        const valA = parseInt(a[currentSortColumn]) || 0;
        const valB = parseInt(b[currentSortColumn]) || 0;
        if (valA !== valB) {
            return currentSortDirection * (valB - valA);
        } else {
            const pA = toPinyin(a.角色名);
            const pB = toPinyin(b.角色名);
            return pA.localeCompare(pB);
        }
      }
    });
  } 
  
  function getColorStyle(val, avg) {
    if(!val || !avg) return '';
    const ratio = val / avg; 
    let r, g, b;
    if (ratio === 1) { r = 255; g = 255; b = 255; }
    else if (ratio > 1) {
        const intensity = Math.min((ratio - 1) / 0.15, 1);
        r = 255;
        g = Math.round(255 * (1 - 0.7 * intensity));
        b = Math.round(255 * (1 - 0.7 * intensity));
    } else {
        const intensity = Math.min((1 - ratio) / 0.15, 1);
        r = Math.round(255 * (1 - 0.7 * intensity));
        g = 255;
        b = Math.round(255 * (1 - 0.7 * intensity));
    }
    return `background-color: rgb(${r}, ${g}, ${b});`;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    
    let tds = `<td class="char-name" style="cursor:pointer; color:#3498db;">${r.角色名}</td>
      <td class="attr-${r.属性}">${r.属性}</td>
      <td>${r.等级}</td>`;
      
    properties.forEach(prop => {
        const val = parseInt(r[prop]) || 0;
        const avg = averages[prop] || 0;
        let style = "";
        let classStr = "";
        if (val > 0 && avg > 0) {
           style = getColorStyle(val, avg);
           classStr = "prop-colored";
        }
        
        tds += `<td class="${classStr}" style="${style}" onclick="makeEditable(this, '${r.角色名}', '${r.等级}', '${prop}', ${val})">${val}</td>`;
    });
    
    tr.innerHTML = tds;

    tr.querySelector('.char-name').addEventListener('click', (e) => {
      e.stopPropagation();
      showCharacterImage(r.角色名);
    });

    tr.querySelectorAll('td:nth-child(2), td:nth-child(3)').forEach(td => {
      td.addEventListener('click', () => {
        showLevelComparison(r.角色名);
      });
    });

    tbody.appendChild(tr);
  });

  document.getElementById('rowCount').textContent = `显示 ${rowCount} 条记录`;
}

window.makeEditable = function(td, charName, level, prop, currentVal) {
   if (prop === "总面板") return;
   if (td.querySelector('input')) return;
   
   const input = document.createElement('input');
   input.type = 'number';
   input.value = currentVal;
   input.className = 'stat-input';
   
   input.onblur = () => {
       const newVal = input.value;
       if (parseInt(newVal) !== currentVal) {
           updateCharStat(charName, level, prop, newVal, td);
       } else {
           renderCharTable();
       }
   };
   
   input.onkeydown = (e) => {
       if (e.key === 'Enter') input.blur();
       if (e.key === 'Escape') renderCharTable();
   };
   
   td.innerHTML = '';
   td.appendChild(input);
   input.focus();
};

window.updateCharStat = async function(charName, level, prop, newValueStr, cellEl) {
    const newValue = parseInt(newValueStr) || 0;
    const charIndex = characters.findIndex(c => c.角色名 === charName);
    if(charIndex === -1) return;
    
    characters[charIndex].面板[level][prop] = newValue.toString();
    
    const p = characters[charIndex].面板[level];
    let newTotal = 0;
    ["体力", "护盾", "break", "灵力", "攻击力", "防御力", "灵击力", "技术", "充能", "运"].forEach(k => {
       newTotal += parseInt(p[k]) || 0;
    });
    characters[charIndex].面板[level]["总面板"] = newTotal.toString();
    
    if(supabaseClient) {
       await supabaseClient
          .from('characters')
          .update({ stats: characters[charIndex].面板 })
          .eq('name', charName);
    }
    
    renderCharTable();
};

function showLevelComparison(characterName) {
  const character = characters.find(c => c.角色名 === characterName);
  if (!character) return;
  
  selectedCharacter = character;
  const comparisonGrid = document.getElementById('comparisonGrid');
  comparisonGrid.innerHTML = '';
  
  const levels = Object.keys(character.面板).sort((a, b) => parseInt(a) - parseInt(b));
  
  levels.forEach(level => {
    const panel = character.面板[level];
    const comparisonItem = document.createElement('div');
    comparisonItem.className = 'comparison-item';
    comparisonItem.innerHTML = 
      `<h4>${level}级属性</h4>
      <div><strong>体力:</strong> ${panel.体力}</div>
      <div><strong>护盾:</strong> ${panel.护盾}</div>
      <div><strong>break:</strong> ${panel.break}</div>
      <div><strong>灵力:</strong> ${panel.灵力}</div>
      <div><strong>攻击力:</strong> ${panel.攻击力}</div>
      <div><strong>防御力:</strong> ${panel.防御力}</div>
      <div><strong>灵击力:</strong> ${panel.灵击力}</div>
      <div><strong>技术:</strong> ${panel.技术}</div>
      <div><strong>充能:</strong> ${panel.充能}</div>
      <div><strong>运:</strong> ${panel.运}</div>
      <div><strong>总面板:</strong> ${panel.总面板}</div>`;
    comparisonGrid.appendChild(comparisonItem);
  });
  
  document.getElementById('levelComparison').style.display = 'block';
}

function showCharacterImage(name) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("charImage");
  const captionText = document.getElementById("caption");
  const zoomSlider = document.getElementById("zoomSlider");
  const zoomValue = document.getElementById("zoomValue");

  currentScale = 1;
  modalImg.style.transform = `scale(${currentScale})`;
  zoomSlider.value = 100;
  zoomValue.textContent = "100%";
  updateSliderThumb();

  modalImg.src = '';
  modalImg.style.opacity = '0';

  modalImg.onload = function() {
    modalImg.style.opacity = '1';
    modalImg.onload = null;
  };
  modalImg.onerror = function() {
    modalImg.src = '';
    modalImg.style.opacity = '1';
    modalImg.onerror = null;
  };

  const encodedName = encodeURIComponent(name);
  modalImg.src = `https://c.dlozs.top/${encodedName}.webp`;
  captionText.innerHTML = name;

  modal.style.display = "block";

  const imageWrapper = document.getElementById("imageWrapper");
  imageWrapper.scrollLeft = 0;
  imageWrapper.scrollTop = 0;

  document.querySelector(".closeBtn").onclick = function() {
    modal.style.display = "none";
  };

  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  };
}

function updateSliderThumb() {
  const slider = document.getElementById('zoomSlider');
  const thumb = document.getElementById('sliderThumb');
  const track = document.querySelector('.slider-track');
  
  const min = parseInt(slider.min);
  const max = parseInt(slider.max);
  const value = parseInt(slider.value);
  
  const percent = (value - min) / (max - min) * 100;
  
  if (window.innerWidth > 968) {
    thumb.style.top = `${100 - percent}%`;
    thumb.style.left = '50%';
  } else {
    thumb.style.left = `${percent}%`;
    thumb.style.top = '50%';
  }
}

document.getElementById('zoomIn').addEventListener('click', function() {
  const zoomSlider = document.getElementById('zoomSlider');
  let newValue = parseInt(zoomSlider.value) + 10;
  if (newValue > 200) newValue = 200;
  zoomSlider.value = newValue;
  updateZoomFromSlider();
});

document.getElementById('zoomOut').addEventListener('click', function() {
  const zoomSlider = document.getElementById('zoomSlider');
  let newValue = parseInt(zoomSlider.value) - 10;
  if (newValue < 10) newValue = 10;
  zoomSlider.value = newValue;
  updateZoomFromSlider();
});

document.getElementById('resetZoom').addEventListener('click', function() {
  const zoomSlider = document.getElementById('zoomSlider');
  zoomSlider.value = 100;
  updateZoomFromSlider();
  
  const imageWrapper = document.getElementById("imageWrapper");
  imageWrapper.scrollLeft = 0;
  imageWrapper.scrollTop = 0;
});

function updateZoomFromSlider() {
  const zoomSlider = document.getElementById('zoomSlider');
  const zoomValue = document.getElementById('zoomValue');
  const modalImg = document.getElementById('charImage');
  
  currentScale = parseInt(zoomSlider.value) / 100;
  modalImg.style.transform = `scale(${currentScale})`;
  zoomValue.textContent = `${zoomSlider.value}%`;
  
  updateSliderThumb();
}

document.getElementById('zoomSlider').addEventListener('input', function() {
  updateZoomFromSlider();
});

updateSliderThumb();

const imageWrapper = document.getElementById("imageWrapper");
imageWrapper.addEventListener('mousedown', startDrag);
imageWrapper.addEventListener('touchstart', startDragTouch);

function startDrag(e) {
  isDragging = true;
  startX = e.pageX - imageWrapper.offsetLeft;
  startY = e.pageY - imageWrapper.offsetTop;
  scrollLeft = imageWrapper.scrollLeft;
  scrollTop = imageWrapper.scrollTop;
  imageWrapper.classList.add('grabbing');
  
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
}

function startDragTouch(e) {
  isDragging = true;
  startX = e.touches[0].pageX - imageWrapper.offsetLeft;
  startY = e.touches[0].pageY - imageWrapper.offsetTop;
  scrollLeft = imageWrapper.scrollLeft;
  scrollTop = imageWrapper.scrollTop;
  
  document.addEventListener('touchmove', dragTouch);
  document.addEventListener('touchend', stopDrag);
}

function drag(e) {
  if (!isDragging) return;
  e.preventDefault();
  const x = e.pageX - imageWrapper.offsetLeft;
  const y = e.pageY - imageWrapper.offsetTop;
  const walkX = (x - startX) * 2;
  const walkY = (y - startY) * 2;
  imageWrapper.scrollLeft = scrollLeft - walkX;
  imageWrapper.scrollTop = scrollTop - walkY;
}

function dragTouch(e) {
  if (!isDragging) return;
  e.preventDefault();
  const x = e.touches[0].pageX - imageWrapper.offsetLeft;
  const y = e.touches[0].pageY - imageWrapper.offsetTop;
  const walkX = (x - startX) * 2;
  const walkY = (y - startY) * 2;
  imageWrapper.scrollLeft = scrollLeft - walkX;
  imageWrapper.scrollTop = scrollTop - walkY;
}

function stopDrag() {
  isDragging = false;
  imageWrapper.classList.remove('grabbing');
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('touchmove', dragTouch);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchend', stopDrag);
}

const slider = document.getElementById('zoomSlider');
const thumb = document.getElementById('sliderThumb');

thumb.addEventListener('mousedown', startThumbDrag);
thumb.addEventListener('touchstart', startThumbDragTouch);

function startThumbDrag(e) {
  e.preventDefault();
  document.addEventListener('mousemove', dragThumb);
  document.addEventListener('mouseup', stopThumbDrag);
}

function startThumbDragTouch(e) {
  e.preventDefault();
  document.addEventListener('touchmove', dragThumbTouch);
  document.addEventListener('touchend', stopThumbDrag);
}

function dragThumb(e) {
  const track = document.querySelector('.slider-track');
  const rect = track.getBoundingClientRect();
  let percent;

  if (window.innerWidth > 968) {
    const y = e.clientY - rect.top;
    percent = 1 - y / rect.height;
  } else {
    const x = e.clientX - rect.left;
    percent = x / rect.width;
  }

  percent = Math.max(0, Math.min(1, percent));
  slider.value = Math.round(parseInt(slider.min) + (parseInt(slider.max) - parseInt(slider.min)) * percent);
  updateZoomFromSlider();
}

function dragThumbTouch(e) {
  const track = document.querySelector('.slider-track');
  const rect = track.getBoundingClientRect();
  let percent;

  if (window.innerWidth > 968) {
    const y = e.touches[0].clientY - rect.top;
    percent = 1 - y / rect.height;
  } else {
    const x = e.touches[0].clientX - rect.left;
    percent = x / rect.width;
  }

  percent = Math.max(0, Math.min(1, percent));
  slider.value = Math.round(parseInt(slider.min) + (parseInt(slider.max) - parseInt(slider.min)) * percent);
  updateZoomFromSlider();
}

function stopThumbDrag() {
  document.removeEventListener('mousemove', dragThumb);
  document.removeEventListener('mouseup', stopThumbDrag);
  document.removeEventListener('touchmove', dragThumbTouch);
  document.removeEventListener('touchend', stopThumbDrag);
}

window.addEventListener('resize', updateSliderThumb);

document.getElementById('nameFilter').addEventListener('input', renderCharTable);
document.getElementById('pinyinFilter').addEventListener('input', renderCharTable);
document.getElementById('attrFilter').addEventListener('change', renderCharTable);
document.getElementById('levelFilter').addEventListener('change', renderCharTable);

// 装备数据库
function renderEquipTable() {
  const tbody = document.querySelector('#equipTable tbody');
  tbody.innerHTML = '';

  const nameVal = document.getElementById('equipNameFilter').value.trim();
  const attrVal = document.getElementById('equipAttrFilter').value;
  const levelVal = document.getElementById('equipLevelFilter').value;
  const sortAttr = document.getElementById('equipSortSelect').value;

  let rows = [];
  let rowCount = 0;

  equipments.forEach(equip => {
    if (!equip.levels[levelVal]) return;
    
    const panel = equip.levels[levelVal];

    if ((nameVal && !equip.name_jp.includes(nameVal) && !(equip.name_cn && equip.name_cn.includes(nameVal))) ||
        (attrVal && equip.attribute !== attrVal)) return;

    const rowData = {
      装备名: equip,
      属性: equip.attribute,
      等级: levelVal,
      体力: panel.体力 || "-",
      护盾: panel.护盾 || "-",
      break: panel.break || "-",
      灵力: panel.灵力 || "-",
      攻击力: panel.攻击力 || "-",
      防御力: panel.防御力 || "-",
      灵击力: panel.灵击力 || "-",
      技术: panel.技术 || "-",
      充能: panel.充能 || "-",
      运: panel.运 || "-",
      总面板: panel.总面板 || "-"
    };

    rows.push(rowData);
    rowCount++;
  });

  if (sortAttr) {
    rows.sort((a, b) => {
      const aVal = a[sortAttr] === "-" ? -1 : parseInt(a[sortAttr]);
      const bVal = b[sortAttr] === "-" ? -1 : parseInt(b[sortAttr]);
      return bVal - aVal;
    });
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `
      <div class="equip-name">${r.装备名.name_cn || r.装备名.name_jp}</div>
      <div class="equip-name-jp">${r.装备名.name_jp}</div>
    `;
    
    const attrCell = document.createElement('td');
    attrCell.className = `attr-${r.属性}`;
    attrCell.textContent = r.属性;
    
    const levelCell = document.createElement('td');
    levelCell.textContent = r.等级;
    
    tr.appendChild(nameCell);
    tr.appendChild(attrCell);
    tr.appendChild(levelCell);
    
    const properties = ["体力", "护盾", "break", "灵力", "攻击力", "防御力", "灵击力", "技术", "充能", "运", "总面板"];
    properties.forEach(prop => {
      const propCell = document.createElement('td');
      propCell.textContent = r[prop];
      
      if (r[prop] !== "-") {
        propCell.className = "property-cell";
        const value = parseInt(r[prop]);
        if (prop === "总面板") {
          if (value > 400) propCell.className += " high-value";
          else if (value > 300) propCell.className += " medium-value";
        } else {
          if (value > 80) propCell.className += " high-value";
          else if (value > 60) propCell.className += " medium-value";
        }
      }
      
      tr.appendChild(propCell);
    });
    
    tbody.appendChild(tr);
  });

  document.getElementById('equipRowCount').textContent = `显示 ${rowCount} 条记录`;
}

document.getElementById('equipNameFilter').addEventListener('input', renderEquipTable);
document.getElementById('equipAttrFilter').addEventListener('change', renderEquipTable);
document.getElementById('equipLevelFilter').addEventListener('change', renderEquipTable);
document.getElementById('equipSortSelect').addEventListener('change', renderEquipTable);

// 总面板计算
let selectedChar = null;
let selectedCharLevel = "60";
let selectedEquips = Array(6).fill(null);
let selectedEquipLevels = Array(6).fill("50");

function initEquipInputs() {
  const equipInputs = document.getElementById('equipInputs');
  equipInputs.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const div = document.createElement('div');
    div.className = 'filters';
    div.innerHTML = `
      <div style="position: relative;">
        <label>装备${i + 1}</label>
        <input type="text" class="equip-input" data-index="${i}" placeholder="输入装备中文名或日文名">
        <div class="autocomplete-suggestions equip-suggestions" data-index="${i}" style="display: none;"></div>
      </div>
      <div>
        <label>等级</label>
        <select class="equip-level" data-index="${i}">
          <option value="30">30级</option>
          <option value="35">35级</option>
          <option value="40">40级</option>
          <option value="45">45级</option>
          <option value="50" selected>50级</option>
        </select>
      </div>
    `;
    equipInputs.appendChild(div);
  }

  document.querySelectorAll('.equip-input').forEach(input => {
    input.addEventListener('input', handleEquipInput);
    input.addEventListener('blur', () => {
      setTimeout(() => {
        const suggestions = input.nextElementSibling;
        suggestions.style.display = 'none';
      }, 200);
    });
  });

  document.querySelectorAll('.equip-level').forEach(select => {
    select.addEventListener('change', (e) => {
      selectedEquipLevels[e.target.dataset.index] = e.target.value;
      calculateTotalPanel();
    });
  });
}

function initInheritSelects() {
  const properties = ["体力", "护盾", "break", "灵力", "攻击力", "防御力", "灵击力", "技术", "充能", "运"];
  document.querySelectorAll('#inheritA select, #inheritB select').forEach(select => {
    const prop = select.dataset.prop;
    const levels = Object.keys(inheritValues[prop] || {});
    select.innerHTML = '<option value="">无</option>' + 
      levels.map(level => `<option value="${level}">${level}</option>`).join('');
    select.addEventListener('change', calculateTotalPanel);
  });
}

function handleCharInput() {
  const input = document.getElementById('charInput');
  const suggestions = document.getElementById('charSuggestions');
  const value = input.value.trim().toLowerCase();
  
  if (!value) {
    suggestions.style.display = 'none';
    return;
  }

  const matches = characters.filter(char => 
    char.角色名.toLowerCase().includes(value) || 
    toPinyin(char.角色名).includes(value)
  );

  suggestions.innerHTML = '';
  matches.forEach(char => {
    const div = document.createElement('div');
    div.className = 'autocomplete-suggestion';
    div.textContent = char.角色名;
    div.addEventListener('click', () => {
      input.value = char.角色名;
      selectedChar = char;
      suggestions.style.display = 'none';
      calculateTotalPanel();
    });
    suggestions.appendChild(div);
  });

  suggestions.style.display = matches.length ? 'block' : 'none';
}

function handleEquipInput(e) {
  const input = e.target;
  const index = input.dataset.index;
  const suggestions = document.querySelector(`.equip-suggestions[data-index="${index}"]`);
  const value = input.value.trim();

  if (!value) {
    suggestions.style.display = 'none';
    return;
  }

  const matches = equipments.filter(equip => 
    (equip.name_cn && equip.name_cn.includes(value)) || 
    equip.name_jp.includes(value)
  );

  suggestions.innerHTML = '';
  matches.forEach(equip => {
    const div = document.createElement('div');
    div.className = 'autocomplete-suggestion';
    div.textContent = equip.name_cn || equip.name_jp;
    div.addEventListener('click', () => {
      input.value = equip.name_cn || equip.name_jp;
      selectedEquips[index] = equip;
      suggestions.style.display = 'none';
      calculateTotalPanel();
    });
    suggestions.appendChild(div);
  });

  suggestions.style.display = matches.length ? 'block' : 'none';
}

function calculateTotalPanel() {
  const properties = ["体力", "护盾", "break", "灵力", "攻击力", "防御力", "灵击力", "技术", "充能", "运"];
  const totals = {};
  let totalSum = 0;

  properties.forEach(prop => {
    totals[prop] = 0;
  });

  if (selectedChar && selectedChar.面板[selectedCharLevel]) {
    const panel = selectedChar.面板[selectedCharLevel];
    properties.forEach(prop => {
      totals[prop] += parseInt(panel[prop]) || 0;
    });
  }

  selectedEquips.forEach((equip, i) => {
    if (equip && equip.levels[selectedEquipLevels[i]]) {
      const panel = equip.levels[selectedEquipLevels[i]];
      properties.forEach(prop => {
        totals[prop] += parseInt(panel[prop]) || 0;
      });
    }
  });

  document.querySelectorAll('#inheritA select, #inheritB select').forEach(select => {
    const prop = select.dataset.prop;
    const level = select.value;
    if (level && inheritValues[prop] && inheritValues[prop][level]) {
      totals[prop] += inheritValues[prop][level];
    }
  });

  properties.forEach(prop => {
    document.getElementById(`total_${prop}`).textContent = totals[prop] || '-';
    totalSum += totals[prop] || 0;
  });

  document.getElementById('total_总面板').textContent = totalSum;
  document.getElementById('total_diff').textContent = 12800 - totalSum;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('charInput').addEventListener('input', handleCharInput);
document.getElementById('charLevel').addEventListener('change', (e) => {
  selectedCharLevel = e.target.value;
  calculateTotalPanel();
});

// 页面加载时初始化数据
document.addEventListener('DOMContentLoaded', function() {
  loadData();
});

window.addNewCharacter = async function() {
  const nameInput = document.getElementById('newCharName');
  const attrSelect = document.getElementById('newCharAttr');
  const name = nameInput.value.trim();
  const attr = attrSelect.value;
  
  if (!name) {
    alert("请输入角色名！");
    return;
  }
  
  if (characters.some(c => c.角色名 === name)) {
    alert("该角色名已存在！");
    return;
  }
  
  const initPanel = {
    "体力": "0", "护盾": "0", "break": "0", "灵力": "0", 
    "攻击力": "0", "防御力": "0", "灵击力": "0", "技术": "0", 
    "充能": "0", "运": "0", "总面板": "0"
  };
  
  const newChar = {
    角色名: name,
    属性: attr,
    面板: {
      "60": { ...initPanel },
      "65": { ...initPanel },
      "70": { ...initPanel },
      "75": { ...initPanel },
      "80": { ...initPanel }
    }
  };
  
  characters.push(newChar);
  
  if (supabaseClient) {
     const { error } = await supabaseClient.from('characters').insert([{
       name: name,
       attribute: attr,
       stats: newChar.面板
     }]);
     
     if (error) {
       console.error("添加至Supabase失败:", error);
       alert("添加至云端失败，但本地已临时添加");
     }
  }
  
  nameInput.value = "";
  renderCharTable();
};
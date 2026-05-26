(function () {
  const root = document.querySelector('[data-action-plan-root]');

  if (!root) {
    return;
  }

  const DATA_URL = root.dataset.planUrl || '../data/health-sector.json';

  const state = {
    section: 'all',
    objective: 'all',
    responsible: 'all',
    quarter: 'all',
    status: 'all'
  };

  let plan = null;
  let actions = [];
  let objectiveById = new Map();
  let quarterById = new Map();

  const els = {
    title: document.getElementById('plan-title'),
    purpose: document.getElementById('plan-purpose'),
    preparedFor: document.getElementById('plan-prepared-for'),
    period: document.getElementById('plan-period'),
    lastUpdated: document.getElementById('plan-last-updated'),
    coalitionRole: document.getElementById('plan-coalition-role'),
    downloadLinks: document.querySelectorAll('[data-download-link]'),
    updateLinks: document.querySelectorAll('[data-update-link]'),
    objectiveStrip: document.getElementById('objective-strip'),
    filters: {
      section: document.getElementById('filter-section'),
      objective: document.getElementById('filter-objective'),
      responsible: document.getElementById('filter-responsible'),
      quarter: document.getElementById('filter-quarter'),
      status: document.getElementById('filter-status')
    },
    reset: document.getElementById('reset-filters'),
    resultCount: document.getElementById('result-count'),
    legend: document.getElementById('objective-legend'),
    chart: document.getElementById('gantt-chart'),
    details: document.getElementById('action-details'),
    loading: document.getElementById('plan-loading'),
    planSwitcher: document.getElementById('plan-switcher')
  };

  fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load ${DATA_URL}`);
      }

      return response.json();
    })
    .then((data) => {
      plan = data;
      objectiveById = new Map(plan.objectives.map((objective) => [objective.id, objective]));
      quarterById = new Map(plan.quarters.map((quarter, index) => [quarter.id, { ...quarter, index: index + 1 }]));
      actions = flattenActions(plan.sections);
      renderStaticContent();
      populateFilters();
      attachEvents();
      render();
    })
    .catch((error) => {
      showError(error);
    });

  function flattenActions(sections) {
    return sections.flatMap((section) =>
      section.actions.map((action) => ({
        ...action,
        sectionId: section.id,
        sectionTitle: section.title
      }))
    );
  }

  function renderStaticContent() {
    const metadata = plan.metadata;

    document.title = `${metadata.shortTitle} | Advancing Together`;
    setText(els.title, metadata.title);
    setText(els.purpose, metadata.shortPurpose);
    setText(els.preparedFor, metadata.preparedFor);
    setText(els.period, metadata.planPeriod);
    setText(els.lastUpdated, formatDate(metadata.lastUpdated));
    setText(els.coalitionRole, metadata.coalitionRole);

    els.downloadLinks.forEach((link) => {
      link.href = metadata.downloadUrl;
    });

    els.updateLinks.forEach((link) => {
      link.href = metadata.updateFormUrl;
    });

    if (els.objectiveStrip) {
      els.objectiveStrip.innerHTML = plan.objectives
        .map((objective) => `
          <article class="objective-card" style="--objective-color:${escapeAttr(objective.color)}">
            <h3 class="objective-card__title">${escapeHtml(objective.title)}</h3>
            <p class="objective-card__outcome">${escapeHtml(objective.outcome)}</p>
          </article>
        `)
        .join('');
    }

    if (els.legend) {
      els.legend.innerHTML = plan.objectives
        .map((objective) => `
          <span class="objective-legend__item">
            <span class="objective-legend__swatch" style="--objective-color:${escapeAttr(objective.color)}"></span>
            ${escapeHtml(objective.title)}
          </span>
        `)
        .join('');
    }

    if (els.loading) {
      els.loading.hidden = true;
    }
  }

  function populateFilters() {
    setOptions(
      els.filters.section,
      plan.sections.map((section) => ({ value: section.id, label: section.title })),
      'All sections'
    );

    setOptions(
      els.filters.objective,
      plan.objectives.map((objective) => ({ value: objective.id, label: objective.title })),
      'All objectives'
    );

    setOptions(
      els.filters.responsible,
      unique(
        actions.flatMap((action) => normalizeList(action.responsibleParties))
      ).map((party) => ({ value: party, label: party })),
      'All responsible parties'
    );

    setOptions(
      els.filters.quarter,
      plan.quarters.map((quarter) => ({ value: quarter.id, label: `${quarter.label}: ${quarter.dateRange}` })),
      'All quarters'
    );

    setOptions(
      els.filters.status,
      plan.statusOptions.map((status) => ({ value: status, label: status })),
      'All statuses'
    );
  }

  function attachEvents() {
    if (els.planSwitcher) {
      const currentPage = window.location.pathname.split('/').pop();
      [...els.planSwitcher.options].forEach((option) => {
        option.selected = option.value === currentPage;
      });

      els.planSwitcher.addEventListener('change', () => {
        if (els.planSwitcher.value) {
          window.location.href = els.planSwitcher.value;
        }
      });
    }

    Object.entries(els.filters).forEach(([key, select]) => {
      if (!select) {
        return;
      }

      select.addEventListener('change', () => {
        state[key] = select.value;
        render();
      });
    });

    if (els.reset) {
      els.reset.addEventListener('click', () => {
        Object.keys(state).forEach((key) => {
          state[key] = 'all';
          if (els.filters[key]) {
            els.filters[key].value = 'all';
          }
        });
        render();
      });
    }
  }

  function render() {
    const filteredActions = actions.filter(matchesFilters);
    renderResultCount(filteredActions.length);
    renderGantt();
    renderDetails(filteredActions);
  }

  function renderResultCount(count) {
    if (!els.resultCount) {
      return;
    }

    const noun = count === 1 ? 'action' : 'actions';
    els.resultCount.textContent = `${count} ${noun} shown`;
  }

  function renderGantt() {
    if (!els.chart) {
      return;
    }

    const header = `
      <div class="gantt-header">
        <div class="gantt-corner">Action</div>
        <div class="gantt-corner">Responsible party(s)</div>
        ${plan.quarters.map((quarter) => `
          <div class="qhead">
            <strong>${escapeHtml(quarter.label)}</strong>
            <span>${escapeHtml(quarter.dateRange)}</span>
          </div>
        `).join('')}
      </div>
    `;

    const sections = plan.sections
      .map((section) => renderSection(section))
      .filter(Boolean)
      .join('');

    els.chart.innerHTML = sections
      ? `${header}${sections}`
      : `${header}<div class="empty-state" style="margin:1rem;">No actions match the selected filters.</div>`;
  }

  function renderSection(section) {
    const visibleActions = section.actions
      .map((action) => ({
        ...action,
        sectionId: section.id,
        sectionTitle: section.title
      }))
      .filter(matchesFilters);

    if (visibleActions.length === 0) {
      return '';
    }

    const objective = getObjective(section.objectiveId);
    const tooltip = `Combined view: ${section.summary} Individual action rows are available when this section is expanded.`;

    return `
      <details class="gantt-section" open>
        <summary class="gantt-summary">
          <div class="group-title">
            <span class="caret" aria-hidden="true"></span>${escapeHtml(section.title)}
            <small>${escapeHtml(section.summary)}</small>
          </div>
          <div class="group-responsible">${escapeHtml(section.responsibleSummary || 'Combined view')}</div>
          <div class="timeline-row group-row">
            ${gridCells()}
            <span class="bar group-bar" style="${barStyle(section.startQuarter, section.endQuarter, objective.color)}" title="${escapeAttr(tooltip)}" data-tip="${escapeAttr(tooltip)}">
              <span>${escapeHtml(quarterRangeLabel(section.startQuarter, section.endQuarter))}</span>
            </span>
          </div>
        </summary>
        <div class="section-actions">
          ${visibleActions.map(renderActionRow).join('')}
        </div>
      </details>
    `;
  }

  function renderActionRow(action) {
    const objective = getObjective(action.objectiveId);
    const tooltip = [
      `${action.id}: ${action.title}`,
      `Key tasks: ${joinList(action.keyTasks)}`,
      `Resources: ${joinList(action.resources)}`,
      `Success indicators: ${joinList(action.successIndicators)}`
    ].join(' | ');

    return `
      <div class="action-cell nested">${escapeHtml(action.title)}</div>
      <div class="responsible-cell nested">${renderList(action.responsibleParties)}</div>
      <div class="timeline-row nested">
        ${gridCells()}
        <span class="bar" tabindex="0" role="img" aria-label="${escapeAttr(tooltip)}" style="${barStyle(action.startQuarter, action.endQuarter, objective.color)}" title="${escapeAttr(tooltip)}" data-tip="${escapeAttr(tooltip)}">
          <span>${escapeHtml(quarterRangeLabel(action.startQuarter, action.endQuarter))}</span>
        </span>
      </div>
    `;
  }

  function renderDetails(filteredActions) {
    if (!els.details) {
      return;
    }

    if (filteredActions.length === 0) {
      els.details.innerHTML = '<div class="empty-state">No detail rows match the selected filters.</div>';
      return;
    }

    els.details.innerHTML = `
      <div class="action-detail-grid">
        ${filteredActions.map(renderDetailCard).join('')}
      </div>
    `;
  }

  function renderDetailCard(action) {
    const objective = getObjective(action.objectiveId);

    return `
      <details class="action-detail-card" style="--objective-color:${escapeAttr(objective.color)}">
        <summary class="action-detail-card__summary">
          <span class="action-detail-card__summary-main">
            <span class="action-detail-card__top">
              <span class="action-detail-card__id">${escapeHtml(action.id)}</span>
              <span class="status-pill">${escapeHtml(action.status)}</span>
            </span>
            <span class="objective-pill">${escapeHtml(objective.shortTitle)}</span>
            <span class="action-detail-card__title">${escapeHtml(action.title)}</span>
            <span class="action-detail-card__meta">
              <span><strong>Section:</strong> ${escapeHtml(action.sectionTitle)}</span>
              <span><strong>Timeline:</strong> ${escapeHtml(quarterRangeLabel(action.startQuarter, action.endQuarter, true))}</span>
              <span><strong>Responsible:</strong> ${escapeHtml(joinList(action.responsibleParties))}</span>
            </span>
          </span>
        </summary>
        <div class="action-detail-card__body">
          ${renderDetailBlock('Key Tasks', action.keyTasks)}
          ${renderDetailBlock('Resources', action.resources)}
          ${renderDetailBlock('Success Indicators', action.successIndicators)}
          <div class="public-update">
            <p><strong>Public update:</strong> ${escapeHtml(action.publicUpdateNote || 'No public update has been posted yet.')}</p>
            <p><strong>Last updated:</strong> ${escapeHtml(formatDate(action.lastUpdated))}</p>
          </div>
        </div>
      </details>
    `;
  }

  function renderDetailBlock(title, items) {
    return `
      <div class="detail-block">
        <h4>${escapeHtml(title)}</h4>
        ${renderList(items)}
      </div>
    `;
  }

  function matchesFilters(action) {
    if (state.section !== 'all' && action.sectionId !== state.section) {
      return false;
    }

    if (state.objective !== 'all' && action.objectiveId !== state.objective) {
      return false;
    }

    if (state.responsible !== 'all') {
      const selected = state.responsible.toLowerCase();
      const hasResponsible = normalizeList(action.responsibleParties).some((party) => {
        const normalized = party.toLowerCase();
        return normalized === selected || normalized.includes(selected) || selected.includes(normalized);
      });

      if (!hasResponsible) {
        return false;
      }
    }

    if (state.quarter !== 'all') {
      const selectedQuarter = quarterIndex(state.quarter);
      if (selectedQuarter < quarterIndex(action.startQuarter) || selectedQuarter > quarterIndex(action.endQuarter)) {
        return false;
      }
    }

    if (state.status !== 'all' && action.status !== state.status) {
      return false;
    }

    return true;
  }

  function setOptions(select, options, allLabel) {
    if (!select) {
      return;
    }

    select.innerHTML = '';
    select.append(new Option(allLabel, 'all'));
    options.forEach((option) => {
      select.append(new Option(option.label, option.value));
    });
  }

  function getObjective(id) {
    return objectiveById.get(id) || {
      id: 'unknown',
      title: 'Unassigned',
      shortTitle: 'Unassigned',
      color: '#475569',
      outcome: ''
    };
  }

  function quarterIndex(id) {
    return quarterById.get(id)?.index || 1;
  }

  function quarterRangeLabel(startQuarter, endQuarter, includeIds) {
    const start = quarterById.get(startQuarter);
    const end = quarterById.get(endQuarter);

    if (!start || !end) {
      return `${startQuarter} - ${endQuarter}`;
    }

    if (startQuarter === endQuarter) {
      return includeIds ? `${startQuarter}: ${start.dateRange}` : start.dateRange;
    }

    if (includeIds) {
      return `${startQuarter}: ${start.dateRange} - ${endQuarter}: ${end.dateRange}`;
    }

    return `${start.dateRange} - ${end.dateRange}`;
  }

  function barStyle(startQuarter, endQuarter, color) {
    const start = quarterIndex(startQuarter);
    const end = quarterIndex(endQuarter) + 1;
    return `--start:${start}; --end:${end}; --color:${escapeAttr(color)};`;
  }

  function gridCells() {
    return Array.from({ length: plan.quarters.length }, () => '<div class="grid-cell"></div>').join('');
  }

  function renderList(items) {
    return `<ul>${normalizeList(items).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function joinList(items) {
    return normalizeList(items).join('; ');
  }

  function normalizeList(items) {
    if (Array.isArray(items)) {
      return items.filter(Boolean);
    }

    if (typeof items === 'string' && items.trim()) {
      return [items.trim()];
    }

    return [];
  }

  function unique(items) {
    return [...new Set(items)].sort((a, b) => a.localeCompare(b));
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value || '';
    }
  }

  function formatDate(value) {
    if (!value) {
      return '';
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function showError(error) {
    if (els.loading) {
      els.loading.hidden = true;
    }

    const message = `
      <div class="error-state">
        The action plan data could not be loaded. This static page expects to be served through GitHub Pages or a local web server so it can fetch <code>${escapeHtml(DATA_URL)}</code>.
      </div>
    `;

    if (els.chart) {
      els.chart.innerHTML = message;
    }

    if (els.details) {
      els.details.innerHTML = '';
    }

    console.error(error);
  }
})();

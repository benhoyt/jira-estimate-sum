(function () {
  'use strict';

  const HOURS_PER_DAY = 8;
  const DAYS_PER_WEEK = 5;
  const HOURS_PER_WEEK = HOURS_PER_DAY * DAYS_PER_WEEK;

  function formatDecimal(val) {
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  }

  function renderBadge(totalHours, issueCount) {
    let badge = document.getElementById('jira-estimate-sum-badge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'jira-estimate-sum-badge';
      badge.className = 'jira-sum-badge';
      document.body.appendChild(badge);
    }

    const totalWeeks = totalHours / HOURS_PER_WEEK;
    const formattedWeeks = `${formatDecimal(totalWeeks)}w`;
    const formattedHours = `${formatDecimal(totalHours)}h`;
    const label = issueCount === 1 ? '1 issue' : `${issueCount} issues`;

    badge.innerHTML = `
      <div class="jira-sum-total">${formattedWeeks} <span class="jira-sum-human">(${formattedHours})</span></div>
      <div class="jira-sum-subtext">${label}</div>
    `;
  }

  function renderBadgeMessage(message) {
    let badge = document.getElementById('jira-estimate-sum-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'jira-estimate-sum-badge';
      badge.className = 'jira-sum-badge';
      document.body.appendChild(badge);
    }
    badge.innerHTML = `
      <div class="jira-sum-subtext">${message}</div>
    `;
  }

  /**
   * Gets the project key from the URL and locates the board ID from sidebar/header links.
   */
  function getBoardId() {
    // 1. Get project key from current path: /jira/software/c/projects/CHARMTECH/list
    const projectMatch = window.location.pathname.match(/\/projects\/([^/]+)\//i);
    if (!projectMatch) return null;
    const projectKey = projectMatch[1];

    // 2. Search DOM for any link pointing to this project's board: .../projects/CHARMTECH/boards/1542
    const selector = `a[href*="/projects/${projectKey}/boards/"]`;
    const boardLink = document.querySelector(selector);
    if (!boardLink) return null;

    // 3. Extract the numeric board ID from the href
    const boardMatch = boardLink.getAttribute('href').match(/\/boards\/(\d+)/i);
    return boardMatch ? boardMatch[1] : null;
  }

  let activeFetchAbort = null;
  let lastProcessedKey = null;

  async function fetchEstimates(boardId, jqlToFetch) {
    if (activeFetchAbort) {
      activeFetchAbort.abort();
    }
    activeFetchAbort = new AbortController();

    const endpoint = `/rest/agile/1.0/board/${boardId}/issue?fields=timeoriginalestimate&maxResults=1000&jql=${encodeURIComponent(jqlToFetch)}`;

    try {
      const response = await fetch(endpoint, {
        signal: activeFetchAbort.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Jira API returned status: ${response.status}`);
        renderBadgeMessage(`API Error (${response.status})`);
        return;
      }

      const data = await response.json();
      const issues = data.issues || [];

      let totalSeconds = 0;

      for (let i = 0; i < issues.length; i++) {
        const seconds = issues[i].fields?.timeoriginalestimate;
        if (typeof seconds === 'number' && seconds > 0) {
          totalSeconds += seconds;
        }
      }

      const totalHours = totalSeconds / 3600;
      renderBadge(totalHours, issues.length);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching estimates from Jira API:', err);
      renderBadgeMessage('Failed to calculate estimate');
    }
  }

  function checkStateChange() {
    const boardId = getBoardId();
    if (!boardId) {
      return; // Sidebar board link not yet rendered or not a project list view
    }

    const urlParams = new URLSearchParams(window.location.search);
    const currentJql = urlParams.get('jql');

    if (!currentJql) {
      if (lastProcessedKey !== null) {
        lastProcessedKey = null;
        renderBadgeMessage('No active JQL in current URL');
      }
      return;
    }

    const stateKey = `${boardId}::${currentJql}`;

    if (stateKey !== lastProcessedKey) {
      lastProcessedKey = stateKey;
      fetchEstimates(boardId, currentJql);
    }
  }

  // 1. Instant update on browser history navigation
  window.addEventListener('popstate', checkStateChange);

  // 2. Low-overhead 1.2s polling (also acts as retries until the sidebar link mounts)
  setInterval(checkStateChange, 1200);

  // Initial run
  checkStateChange();
})();

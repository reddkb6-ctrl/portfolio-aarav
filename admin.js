(function () {
  'use strict';

  var $ = function (selector, parent) { return (parent || document).querySelector(selector); };
  var $$ = function (selector, parent) { return Array.prototype.slice.call((parent || document).querySelectorAll(selector)); };
  var gate = $('#admin-gate');
  var shell = $('#admin-shell');
  var loginForm = $('#admin-login-form');
  var loginInput = $('#admin-password');
  var loginButton = $('#admin-login-button');
  var loginStatus = $('#login-status');
  var globalStatus = $('#admin-global-status');
  var contentForm = $('#content-form');
  var contentFields = $('#content-fields');
  var saveButton = $('#content-save-button');
  var resetButton = $('#content-reset-button');
  var contentSaveStatus = $('#content-save-status');
  var reviewList = $('#admin-review-list');
  var reviewListStatus = $('#review-list-status');
  var reviewSearch = $('#review-search');
  var reviewFilter = $('#review-filter');
  var overviewRecent = $('#overview-recent-reviews');

  var state = {
    content: {},
    defaults: {},
    reviews: [],
    activeView: 'overview',
    contentDirty: false,
    busy: false
  };

  var viewDetails = {
    overview: ['Overview', 'Your website at a glance.'],
    content: ['Website editor', 'Make changes to the content visitors see.'],
    reviews: ['Review moderation', 'Manage feedback submitted by your visitors.'],
    settings: ['Settings', 'Security and storage information for your portfolio.']
  };

  var contentGroups = [
    {
      title: 'Page and search settings',
      description: 'The browser title and description shown when your website is shared.',
      fields: [
        { key: 'siteTitle', label: 'Page title', type: 'text', hint: 'Shown in the browser tab and link previews.' },
        { key: 'siteDescription', label: 'Site description', type: 'textarea', hint: 'A short description for search engines and social previews.', wide: true }
      ]
    },
    {
      title: 'Homepage introduction',
      description: 'The main heading and introduction on your portfolio homepage.',
      fields: [
        { key: 'heroName', label: 'Name in the main heading', type: 'text' },
        { key: 'heroIntro', label: 'Introduction text', type: 'textarea', wide: true }
      ]
    },
    {
      title: 'About section',
      description: 'Your introduction and the small note card next to it.',
      fields: [
        { key: 'aboutText', label: 'About paragraph', type: 'textarea', wide: true },
        { key: 'aboutNoteTitle', label: 'Note card heading', type: 'text' },
        { key: 'aboutNoteText', label: 'Note card text', type: 'textarea', wide: true }
      ]
    },
    {
      title: 'Games section',
      description: 'The sentence shown below the Games heading.',
      fields: [{ key: 'gamesIntro', label: 'Games introduction', type: 'textarea', wide: true }]
    },
    {
      title: 'Experience · KFC',
      description: 'Edit the KFC project card and its link.',
      fields: [
        { key: 'kfcTag', label: 'Small category label', type: 'text' },
        { key: 'kfcTitle', label: 'Card title', type: 'text' },
        { key: 'kfcDescription', label: 'Description', type: 'textarea', wide: true },
        { key: 'kfcUrl', label: 'Card link URL', type: 'url', hint: 'Use a full HTTPS link. Leave blank to hide the card link.', wide: true }
      ]
    },
    {
      title: 'Experience · Headteacher',
      description: 'Edit the school-roleplay experience card and its link.',
      fields: [
        { key: 'headteacherTag', label: 'Small category label', type: 'text' },
        { key: 'headteacherTitle', label: 'Card title', type: 'text' },
        { key: 'headteacherDescription', label: 'Description', type: 'textarea', wide: true },
        { key: 'headteacherUrl', label: 'Card link URL', type: 'url', hint: 'Use a full HTTPS link. Leave blank to hide the card link.', wide: true }
      ]
    },
    {
      title: 'Experience · AVARA',
      description: 'Edit the AVARA experience card and its link.',
      fields: [
        { key: 'avaraTag', label: 'Small category label', type: 'text' },
        { key: 'avaraTitle', label: 'Card title', type: 'text' },
        { key: 'avaraDescription', label: 'Description', type: 'textarea', wide: true },
        { key: 'avaraUrl', label: 'Card link URL', type: 'url', hint: 'Use a full HTTPS link. Leave blank to hide the card link.', wide: true }
      ]
    },
    {
      title: 'Interests and skills',
      description: 'Edit the introduction and each of the four interest cards.',
      fields: [
        { key: 'interestsIntro', label: 'Section introduction', type: 'textarea', wide: true },
        { key: 'gamingTitle', label: 'Gaming · title', type: 'text' },
        { key: 'gamingDescription', label: 'Gaming · description', type: 'textarea' },
        { key: 'sportsTitle', label: 'Sports · title', type: 'text' },
        { key: 'sportsDescription', label: 'Sports · description', type: 'textarea' },
        { key: 'musicTitle', label: 'Music · title', type: 'text' },
        { key: 'musicDescription', label: 'Music · description', type: 'textarea' },
        { key: 'leadershipTitle', label: 'HR & leadership · title', type: 'text' },
        { key: 'leadershipDescription', label: 'HR & leadership · description', type: 'textarea' }
      ]
    },
    {
      title: 'Socials and contact',
      description: 'Update your Socials introduction, Discord card and public profile links.',
      fields: [
        { key: 'socialsIntro', label: 'Socials introduction', type: 'textarea', wide: true },
        { key: 'discordProfileTitle', label: 'Discord card heading', type: 'text' },
        { key: 'discordProfileDescription', label: 'Discord card description', type: 'textarea', wide: true },
        { key: 'discordProfileUrl', label: 'Discord profile card URL', type: 'url', wide: true },
        { key: 'socialRobloxUrl', label: 'Roblox profile URL', type: 'url', wide: true },
        { key: 'socialDiscordUrl', label: 'Discord URL', type: 'url', wide: true },
        { key: 'socialTikTokUrl', label: 'TikTok URL', type: 'url', wide: true },
        { key: 'socialYouTubeUrl', label: 'YouTube URL', type: 'url', wide: true },
        { key: 'socialSnapchatUrl', label: 'Snapchat URL', type: 'url', wide: true },
        { key: 'socialSignalUrl', label: 'Signal URL', type: 'url', wide: true }
      ]
    }
  ];

  function make(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  }

  function request(url, options) {
    var config = options || {};
    config.credentials = 'same-origin';
    config.headers = Object.assign({ Accept: 'application/json' }, config.headers || {});
    return fetch(url, config).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) {
          var error = new Error(data.error || 'The request could not be completed.');
          error.status = response.status;
          throw error;
        }
        return data;
      });
    });
  }

  function setLoginStatus(message, kind) {
    loginStatus.className = 'form-status' + (kind ? ' is-' + kind : '');
    loginStatus.textContent = message || '';
  }

  function setGlobalStatus(message, kind) {
    globalStatus.className = 'global-status' + (kind ? ' is-' + kind : '');
    globalStatus.textContent = message || '';
  }

  function showGate(message, kind) {
    gate.hidden = false;
    shell.hidden = true;
    loginInput.value = '';
    loginButton.disabled = false;
    loginButton.innerHTML = 'Sign in securely <span aria-hidden="true">→</span>';
    setLoginStatus(message || '', kind || '');
    if (!message) loginInput.focus();
  }

  function showShell() {
    gate.hidden = true;
    shell.hidden = false;
    setLoginStatus('', '');
    switchView(state.activeView || 'overview');
  }

  function isUnauthorised(error) {
    if (error && error.status === 401) {
      showGate('Your admin session has expired. Please sign in again.', 'error');
      return true;
    }
    return false;
  }

  function switchView(name) {
    if (!viewDetails[name]) name = 'overview';
    state.activeView = name;
    $$('.admin-view').forEach(function (view) {
      var active = view.dataset.view === name;
      view.hidden = !active;
      view.classList.toggle('is-visible', active);
    });
    $$('.side-link[data-view-target]').forEach(function (button) {
      var active = button.dataset.viewTarget === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    $('#view-title').textContent = viewDetails[name][0];
    $('#view-subtitle').textContent = viewDetails[name][1];
    if (name === 'reviews') loadReviews();
    if (name === 'content' && !contentFields.dataset.ready) loadContent();
    if (name === 'overview') renderOverview();
  }

  function loadDashboard() {
    setGlobalStatus('Loading your dashboard…', '');
    Promise.all([loadContent(), loadReviews()]).then(function () {
      setGlobalStatus('', '');
      renderOverview();
    }).catch(function (error) {
      if (!isUnauthorised(error)) setGlobalStatus(error.message || 'Some dashboard data could not be loaded.', 'error');
    });
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!loginInput.value) {
      setLoginStatus('Enter your admin password.', 'error');
      loginInput.focus();
      return;
    }
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in…';
    setLoginStatus('Checking your credentials…', '');
    request('/api/moderation/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: loginInput.value })
    }).then(function () {
      loginForm.reset();
      state.contentDirty = false;
      showShell();
      loadDashboard();
    }).catch(function (error) {
      setLoginStatus(error.message || 'Sign-in failed.', 'error');
    }).finally(function () {
      loginButton.disabled = false;
      loginButton.innerHTML = 'Sign in securely <span aria-hidden="true">→</span>';
    });
  });

  function logout() {
    request('/api/moderation/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).catch(function () {}).finally(function () {
      state.contentDirty = false;
      showGate('You have signed out.', 'success');
    });
  }

  $('#admin-logout-button').addEventListener('click', logout);
  $('#settings-logout-button').addEventListener('click', logout);

  $$('.side-link[data-view-target]').forEach(function (button) {
    button.addEventListener('click', function () { switchView(button.dataset.viewTarget); });
  });
  $$('[data-go-view]').forEach(function (button) {
    button.addEventListener('click', function () { switchView(button.dataset.goView); });
  });

  function renderContentEditor() {
    contentFields.textContent = '';
    contentGroups.forEach(function (group) {
      var section = make('section', 'editor-group');
      var heading = make('div', 'editor-group-head');
      heading.appendChild(make('h3', '', group.title));
      heading.appendChild(make('p', '', group.description));
      section.appendChild(heading);
      var grid = make('div', 'field-grid');

      group.fields.forEach(function (field) {
        var wrapper = make('div', 'admin-field' + (field.wide ? ' wide' : ''));
        var id = 'field-' + field.key;
        var label = make('label', '', field.label);
        label.htmlFor = id;
        wrapper.appendChild(label);

        var control = make(field.type === 'textarea' ? 'textarea' : 'input');
        control.id = id;
        control.name = field.key;
        control.dataset.key = field.key;
        control.maxLength =  field.type === 'url' ? 500 : maxLengthFor(field.key);
        if (field.type !== 'textarea') control.type = field.type === 'url' ? 'url' : 'text';
        if (field.type === 'textarea') {
          control.rows = 3;
          if (['siteDescription', 'gamesIntro', 'interestsIntro', 'gamingDescription', 'sportsDescription', 'musicDescription', 'leadershipDescription', 'discordProfileDescription'].includes(field.key)) {
            control.classList.add('short-textarea');
          }
        }
        control.value = typeof state.content[field.key] === 'string' ? state.content[field.key] : '';
        control.autocomplete = 'off';
        if (field.type === 'url') {
          control.spellcheck = false;
          control.placeholder = 'https://…';
        }
        if (field.hint) {
          var hint = make('span', 'field-hint', field.hint);
          hint.id = id + '-hint';
          wrapper.appendChild(control);
          wrapper.appendChild(hint);
          control.setAttribute('aria-describedby', hint.id);
        } else {
          wrapper.appendChild(control);
        }
        grid.appendChild(wrapper);
      });
      section.appendChild(grid);
      contentFields.appendChild(section);
    });
    contentFields.dataset.ready = 'true';
    setContentDirty(false);
  }

  function maxLengthFor(key) {
    var limits = {
      siteTitle: 100, siteDescription: 240, heroName: 50, heroIntro: 400,
      aboutText: 700, aboutNoteTitle: 100, aboutNoteText: 400, gamesIntro: 300,
      kfcTag: 140, kfcTitle: 100, kfcDescription: 500, headteacherTag: 140,
      headteacherTitle: 100, headteacherDescription: 500, avaraTag: 140,
      avaraTitle: 100, avaraDescription: 500, interestsIntro: 300,
      gamingTitle: 100, gamingDescription: 300, sportsTitle: 100,
      sportsDescription: 300, musicTitle: 100, musicDescription: 300,
      leadershipTitle: 100, leadershipDescription: 300, socialsIntro: 300,
      discordProfileTitle: 100, discordProfileDescription: 300
    };
    return limits[key] || 500;
  }

  function setContentDirty(dirty) {
    state.contentDirty = Boolean(dirty);
    contentSaveStatus.className = 'save-status' + (dirty ? ' is-dirty' : '');
    contentSaveStatus.textContent = dirty ? 'You have unsaved changes.' : 'Changes are saved.';
  }

  function loadContent() {
    return request('/api/admin/content', { cache: 'no-store' }).then(function (data) {
      state.content = data.content || {};
      state.defaults = data.defaults || {};
      renderContentEditor();
      $('#storage-status').textContent = 'Content file: ' + (state.content ? 'loaded' : 'not loaded') + '. Keep the Fusion data directory persistent to retain changes after redeployments.';
      return data;
    }).catch(function (error) {
      if (!isUnauthorised(error)) {
        contentFields.textContent = '';
        contentFields.appendChild(make('p', 'empty-state', error.message || 'Website content could not be loaded.'));
        setContentDirty(false);
      }
      throw error;
    });
  }

  contentForm.addEventListener('input', function (event) {
    if (event.target && event.target.dataset && event.target.dataset.key) {
      setContentDirty(true);
    }
  });

  contentForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (saveButton.disabled) return;
    var nextContent = {};
    $$('[data-key]', contentFields).forEach(function (control) {
      nextContent[control.dataset.key] = control.value;
    });
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    contentSaveStatus.textContent = 'Saving your changes…';
    contentSaveStatus.className = 'save-status';
    request('/api/admin/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: nextContent })
    }).then(function (data) {
      state.content = data.content || nextContent;
      renderContentEditor();
      contentSaveStatus.textContent = 'Changes saved. Refresh the public website to see them.';
      contentSaveStatus.className = 'save-status is-success';
      setGlobalStatus('Website content saved successfully.', 'success');
    }).catch(function (error) {
      if (!isUnauthorised(error)) {
        contentSaveStatus.textContent = error.message || 'Changes could not be saved.';
        contentSaveStatus.className = 'save-status is-error';
      }
    }).finally(function () {
      saveButton.disabled = false;
      saveButton.textContent = 'Save changes';
    });
  });

  resetButton.addEventListener('click', function () {
    if (!window.confirm('Restore the editor fields to the original website defaults? You will still need to click Save changes to publish the reset.')) return;
    state.content = Object.assign({}, state.defaults);
    renderContentEditor();
    setContentDirty(true);
    contentSaveStatus.textContent = 'Original values loaded. Click Save changes to publish.';
    contentSaveStatus.className = 'save-status is-dirty';
  });

  function displayDate(value) {
    var date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function initials(value) {
    var trimmed = String(value || '?').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
  }

  function starsFor(value) {
    var rating = Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  function visibleReviews() {
    return state.reviews.filter(function (review) { return review.hidden !== true; });
  }

  function renderOverview() {
    var publicReviews = visibleReviews();
    var hiddenCount = state.reviews.length - publicReviews.length;
    var average = publicReviews.length
      ? publicReviews.reduce(function (sum, review) { return sum + (Number(review.rating) || 0); }, 0) / publicReviews.length
      : null;
    $('#stat-reviews').textContent = String(state.reviews.length);
    $('#stat-public').textContent = String(publicReviews.length);
    $('#stat-hidden').textContent = String(hiddenCount);
    $('#stat-average').textContent = average === null ? '—' : average.toFixed(1);
    $('#nav-review-count').textContent = String(state.reviews.length);

    overviewRecent.textContent = '';
    if (!state.reviews.length) {
      overviewRecent.appendChild(make('p', 'empty-state', 'No reviews have been submitted yet.'));
      return;
    }
    state.reviews.slice(0, 4).forEach(function (review) {
      var row = make('div', 'recent-row');
      row.appendChild(make('span', 'review-avatar', initials(review.name)));
      var copy = make('div', 'recent-copy');
      copy.appendChild(make('strong', '', String(review.name || 'Visitor')));
      copy.appendChild(make('small', '', displayDate(review.createdAt) + (review.hidden ? ' · Hidden' : ' · Public')));
      row.appendChild(copy);
      row.appendChild(make('span', 'recent-rating', starsFor(review.rating)));
      overviewRecent.appendChild(row);
    });
  }

  function renderReviews() {
    var query = reviewSearch.value.trim().toLowerCase();
    var filter = reviewFilter.value;
    var reviews = state.reviews.filter(function (review) {
      var hidden = review.hidden === true;
      if (filter === 'visible' && hidden) return false;
      if (filter === 'hidden' && !hidden) return false;
      var searchable = [review.name, review.comment].join(' ').toLowerCase();
      return !query || searchable.includes(query);
    });

    reviewList.textContent = '';
    if (!reviews.length) {
      reviewList.appendChild(make('p', 'empty-state', state.reviews.length ? 'No reviews match these filters.' : 'No reviews have been submitted yet.'));
      reviewListStatus.textContent = '';
      return;
    }

    reviews.forEach(function (review) {
      var card = make('article', 'admin-review-card');
      var header = make('div', 'admin-review-head');
      var person = make('div', 'admin-review-person');
      person.appendChild(make('span', 'review-avatar', initials(review.name)));
      var identity = make('div');
      identity.appendChild(make('h3', '', String(review.name || 'Visitor')));
      identity.appendChild(make('p', 'admin-review-meta', displayDate(review.createdAt)));
      person.appendChild(identity);
      header.appendChild(person);
      var stars = make('span', 'admin-review-stars', starsFor(review.rating));
      stars.setAttribute('aria-label', String(review.rating) + ' out of 5');
      header.appendChild(stars);
      card.appendChild(header);

      var hidden = review.hidden === true;
      var status = make('span', 'review-state' + (hidden ? ' is-hidden' : ''), hidden ? 'Hidden from public' : 'Visible to public');
      card.appendChild(status);
      if (review.comment) card.appendChild(make('p', 'admin-review-comment', String(review.comment)));

      var actions = make('div', 'admin-review-actions');
      var toggleButton = make('button', 'button', hidden ? 'Restore review' : 'Hide review');
      toggleButton.type = 'button';
      toggleButton.addEventListener('click', function () { changeVisibility(review, hidden ? 'restore' : 'hide', toggleButton); });
      var deleteButton = make('button', 'button button-danger', 'Delete permanently');
      deleteButton.type = 'button';
      deleteButton.addEventListener('click', function () { deleteReview(review, deleteButton); });
      actions.appendChild(toggleButton);
      actions.appendChild(deleteButton);
      card.appendChild(actions);
      reviewList.appendChild(card);
    });
    reviewListStatus.textContent = 'Showing ' + reviews.length + ' of ' + state.reviews.length + ' reviews.';
  }

  function loadReviews() {
    return request('/api/moderation/reviews', { cache: 'no-store' }).then(function (data) {
      state.reviews = Array.isArray(data.reviews) ? data.reviews : [];
      renderReviews();
      renderOverview();
      return data;
    }).catch(function (error) {
      if (!isUnauthorised(error)) {
        reviewList.textContent = '';
        reviewList.appendChild(make('p', 'empty-state', error.message || 'Reviews could not be loaded.'));
      }
      throw error;
    });
  }

  function changeVisibility(review, action, button) {
    button.disabled = true;
    button.textContent = action === 'hide' ? 'Hiding…' : 'Restoring…';
    request('/api/moderation/reviews/' + encodeURIComponent(review.id) + '/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    }).then(function () {
      setGlobalStatus(action === 'hide' ? 'Review hidden from the public list.' : 'Review restored to the public list.', 'success');
      return loadReviews();
    }).catch(function (error) {
      if (!isUnauthorised(error)) setGlobalStatus(error.message || 'The review could not be updated.', 'error');
    }).finally(function () {
      button.disabled = false;
    });
  }

  function deleteReview(review, button) {
    if (!window.confirm('Permanently delete the review from ' + String(review.name || 'this visitor') + '? This cannot be undone.')) return;
    button.disabled = true;
    button.textContent = 'Deleting…';
    request('/api/moderation/reviews/' + encodeURIComponent(review.id), {
      method: 'DELETE'
    }).then(function () {
      setGlobalStatus('Review permanently deleted.', 'success');
      return loadReviews();
    }).catch(function (error) {
      if (!isUnauthorised(error)) setGlobalStatus(error.message || 'The review could not be deleted.', 'error');
    }).finally(function () {
      button.disabled = false;
    });
  }

  $('#refresh-reviews-button').addEventListener('click', function () {
    var button = this;
    button.disabled = true;
    button.textContent = 'Refreshing…';
    loadReviews().then(function () {
      setGlobalStatus('Reviews refreshed.', 'success');
    }).catch(function () {}).finally(function () {
      button.disabled = false;
      button.textContent = '↻ Refresh reviews';
    });
  });
  reviewSearch.addEventListener('input', renderReviews);
  reviewFilter.addEventListener('change', renderReviews);

  request('/api/moderation/session', { cache: 'no-store' }).then(function (data) {
    if (data.authenticated) {
      showShell();
      loadDashboard();
    } else {
      showGate('', '');
    }
  }).catch(function () {
    showGate('Admin sign-in could not be checked. Refresh the page and try again.', 'error');
  });
})();
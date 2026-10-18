(function () {
  'use strict';

  var root = document.getElementById('reviews-app');
  if (!root) return;

  function make(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof value === 'string') node.textContent = value;
    return node;
  }

  function labelFor(text, id) {
    var label = make('label', '', text);
    label.htmlFor = id;
    return label;
  }

  function field(className, labelText, id, control) {
    var wrapper = make('div', className);
    wrapper.appendChild(labelFor(labelText, id));
    wrapper.appendChild(control);
    return wrapper;
  }

  var layout = make('div', 'reviews-grid');
  var form = make('form', 'review-form');
  form.id = 'review-form';
  form.noValidate = true;

  var nameInput = make('input');
  nameInput.type = 'text';
  nameInput.id = 'review-name';
  nameInput.name = 'name';
  nameInput.maxLength = 50;
  nameInput.autocomplete = 'name';
  nameInput.required = true;
  nameInput.placeholder = 'Your name';
  form.appendChild(field('review-field', 'Your name', nameInput.id, nameInput));

  var ratingField = make('fieldset', 'review-field rating-field');
  var ratingLegend = make('legend', '', 'Rate this website /5:');
  ratingField.appendChild(ratingLegend);
  var ratingPicker = make('div', 'rating-picker');
  ratingPicker.id = 'review-rating-picker';
  ratingPicker.setAttribute('role', 'group');
  ratingPicker.setAttribute('aria-label', 'Rate this website out of five');
  var ratingButtons = [];
  for (var starNumber = 1; starNumber <= 5; starNumber += 1) {
    var star = make('button', 'rating-star', '☆');
    star.type = 'button';
    star.dataset.rating = String(starNumber);
    star.setAttribute('aria-label', starNumber + ' out of 5');
    star.setAttribute('aria-pressed', 'false');
    ratingPicker.appendChild(star);
    ratingButtons.push(star);
  }
  ratingField.appendChild(ratingPicker);
  var ratingInput = make('input');
  ratingInput.type = 'hidden';
  ratingInput.id = 'review-rating';
  ratingInput.name = 'rating';
  ratingField.appendChild(ratingInput);
  var ratingValue = make('span', 'rating-value', 'Choose a rating');
  ratingValue.id = 'review-rating-value';
  ratingValue.setAttribute('aria-live', 'polite');
  ratingField.appendChild(ratingValue);
  form.appendChild(ratingField);

  var commentInput = make('textarea');
  commentInput.id = 'review-comment';
  commentInput.name = 'comment';
  commentInput.rows = 4;
  commentInput.maxLength = 600;
  commentInput.placeholder = 'Write a comment…';
  var commentField = make('div', 'review-field');
  commentField.appendChild(labelFor('Any Other comments:', commentInput.id));
  var optional = make('span', 'field-optional', 'Optional');
  commentField.lastChild.appendChild(optional);
  commentField.appendChild(commentInput);
  var commentCount = make('span', 'field-counter', '0 / 600');
  commentCount.id = 'review-comment-count';
  commentField.appendChild(commentCount);
  form.appendChild(commentField);

  var trapField = make('div', 'review-trap');
  trapField.setAttribute('aria-hidden', 'true');
  var trapLabel = labelFor('Leave this field empty', 'review-website');
  var trapInput = make('input');
  trapInput.type = 'text';
  trapInput.id = 'review-website';
  trapInput.name = 'website';
  trapInput.tabIndex = -1;
  trapInput.autocomplete = 'off';
  trapField.appendChild(trapLabel);
  trapField.appendChild(trapInput);
  form.appendChild(trapField);

  var submitButton = make('button', 'btn btn-main review-submit');
  submitButton.id = 'review-submit';
  submitButton.type = 'submit';
  var submitIcon = make('i');
  submitIcon.setAttribute('data-lucide', 'send');
  submitIcon.setAttribute('aria-hidden', 'true');
  submitButton.appendChild(submitIcon);
  submitButton.appendChild(make('span', '', 'Submit review'));
  form.appendChild(submitButton);
  var formStatus = make('p', 'review-form-status');
  formStatus.id = 'review-form-status';
  formStatus.setAttribute('role', 'status');
  formStatus.setAttribute('aria-live', 'polite');
  form.appendChild(formStatus);

  var panel = make('div', 'reviews-panel');
  var summary = make('div', 'reviews-summary');
  var averageBox = make('div', 'reviews-average');
  var averageValue = make('strong', '', '—');
  averageValue.id = 'reviews-average';
  averageBox.appendChild(averageValue);
  averageBox.appendChild(make('span', '', 'Average rating'));
  var totalBox = make('div', 'reviews-total');
  var totalValue = make('strong', '', '0');
  totalValue.id = 'reviews-total';
  totalBox.appendChild(totalValue);
  totalBox.appendChild(make('span', '', 'Reviews submitted'));
  summary.appendChild(averageBox);
  summary.appendChild(totalBox);
  panel.appendChild(summary);
  var list = make('div', 'reviews-list');
  list.id = 'reviews-list';
  list.setAttribute('aria-live', 'polite');
  list.setAttribute('aria-busy', 'true');
  list.appendChild(make('p', 'review-empty', 'Loading reviews…'));
  panel.appendChild(list);
  layout.appendChild(form);
  layout.appendChild(panel);
  root.textContent = '';
  root.appendChild(layout);

  var selectedRating = 0;
  var loadedReviews = [];
  var submitting = false;
  var hasLoadedReviews = false;

  function setRating(value) {
    selectedRating = value;
    ratingInput.value = value ? String(value) : '';
    ratingValue.textContent = value ? value + ' out of 5' : 'Choose a rating';
    ratingButtons.forEach(function (button) {
      var number = Number(button.dataset.rating);
      var isFilled = value > 0 && number <= value;
      button.classList.toggle('is-selected', isFilled);
      button.setAttribute('aria-pressed', String(number === value));
      button.textContent = isFilled ? '★' : '☆';
    });
  }

  ratingButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setRating(Number(button.dataset.rating));
    });
    button.addEventListener('keydown', function (event) {
      var current = Number(button.dataset.rating);
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        var next = Math.min(5, current + 1);
        ratingButtons[next - 1].focus();
        setRating(next);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        var previous = Math.max(1, current - 1);
        ratingButtons[previous - 1].focus();
        setRating(previous);
      }
    });
  });

  commentInput.addEventListener('input', function () {
    commentCount.textContent = commentInput.value.length + ' / 600';
  });

  function showStatus(message, state) {
    formStatus.className = 'review-form-status' + (state ? ' is-' + state : '');
    formStatus.textContent = message;
  }

  function displayDate(value) {
    var date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(date);
  }

  function renderReviews(reviews, averageFromServer) {
    loadedReviews = Array.isArray(reviews) ? reviews : [];
    list.textContent = '';
    list.setAttribute('aria-busy', 'false');
    totalValue.textContent = String(loadedReviews.length);
    if (typeof averageFromServer === 'number' && loadedReviews.length) {
      averageValue.textContent = averageFromServer.toFixed(1);
    } else {
      averageValue.textContent = '—';
    }

    if (!loadedReviews.length) {
      list.appendChild(make('p', 'review-empty', 'No reviews yet.'));
      return;
    }

    loadedReviews.forEach(function (review) {
      var card = make('article', 'review-card');
      var header = make('div', 'review-card-head');
      var identity = make('div', 'review-identity');
      identity.appendChild(make('h3', 'review-name', String(review.name || 'Visitor')));
      var time = make('time', 'review-date', displayDate(review.createdAt));
      if (review.createdAt) time.dateTime = String(review.createdAt);
      identity.appendChild(time);
      var rating = Math.max(1, Math.min(5, Math.round(Number(review.rating) || 1)));
      var stars = make('span', 'review-stars', '★'.repeat(rating) + '☆'.repeat(5 - rating));
      stars.setAttribute('aria-label', rating + ' out of 5');
      header.appendChild(identity);
      header.appendChild(stars);
      card.appendChild(header);
      if (review.comment) {
        card.appendChild(make('p', 'review-comment', String(review.comment)));
      }
      list.appendChild(card);
    });
  }

  function loadReviews() {
    list.setAttribute('aria-busy', 'true');
    fetch('/api/reviews', {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) throw new Error('Reviews unavailable');
      return response.json();
    }).then(function (data) {
      renderReviews(data.reviews, data.average);
      hasLoadedReviews = true;
    }).catch(function () {
      list.setAttribute('aria-busy', 'false');
      list.textContent = '';
      list.appendChild(make('p', 'review-empty',
        hasLoadedReviews ? 'Could not refresh reviews.' : 'Reviews could not be loaded. Please try again later.'));
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submitting) return;

    var name = nameInput.value.trim();
    var comment = commentInput.value.trim();

    if (!name) {
      showStatus('Please enter your name.', 'error');
      nameInput.focus();
      return;
    }
    if (name.length > 50) {
      showStatus('Your name must be 50 characters or fewer.', 'error');
      nameInput.focus();
      return;
    }
    if (!selectedRating) {
      showStatus('Please choose a rating out of 5.', 'error');
      ratingButtons[0].focus();
      return;
    }
    if (comment.length > 600) {
      showStatus('Comments must be 600 characters or fewer.', 'error');
      commentInput.focus();
      return;
    }

    submitting = true;
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.lastChild.textContent = 'Submitting…';
    showStatus('Submitting your review…', '');

    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: name,
        rating: selectedRating,
        comment: comment,
        website: trapInput.value
      })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Your review could not be submitted. Please try again.');
        return data;
      });
    }).then(function (data) {
      form.reset();
      setRating(0);
      commentCount.textContent = '0 / 600';
      showStatus('Thank you — your review has been submitted.', 'success');
      loadReviews();
    }).catch(function (error) {
      showStatus(error && error.message ? error.message : 'Your review could not be submitted. Please try again.', 'error');
    }).finally(function () {
      submitting = false;
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
      submitButton.removeAttribute('aria-busy');
      submitButton.lastChild.textContent = 'Submit review';
    });
  });

  setRating(0);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ attrs: { 'stroke-width': 2.1 } });
  }
  loadReviews();
})();
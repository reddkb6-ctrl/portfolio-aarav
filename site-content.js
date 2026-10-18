(function () {
  'use strict';

  function setText(selector, value) {
    if (typeof value !== 'string') return;
    var node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function setProject(prefix, keyPrefix) {
    setText('.project-' + prefix + ' .project-tag', keyPrefix + 'Tag');
    setText('.project-' + prefix + ' h3', keyPrefix + 'Title');
    setText('.project-' + prefix + ' > p', keyPrefix + 'Description');
    setUrl('.project-' + prefix + ' .project-links a', keyPrefix + 'Url', true);
  }

  function isSafeHttps(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch (_) {
      return false;
    }
  }

  function setUrl(selector, value, hideWrapper) {
    if (typeof value !== 'string') return;
    var node = document.querySelector(selector);
    if (!node) return;
    if (value && isSafeHttps(value)) {
      node.href = value;
      node.hidden = false;
    } else {
      node.hidden = true;
    }
    if (hideWrapper && node.parentElement) {
      node.parentElement.hidden = !value || !isSafeHttps(value);
    }
  }

  function applyContent(content) {
    if (!content || typeof content !== 'object') return;
    setText('title', content.siteTitle);
    setText('.hero h1 .gradient', content.heroName);
    setText('.hero .intro', content.heroIntro);
    setText('#about .about-grid > .text', content.aboutText);
    setText('.about-note strong', content.aboutNoteTitle);
    setText('.about-note p', content.aboutNoteText);
    setText('#games > p.text', content.gamesIntro);
    setProject('kfc', 'kfc');
    setProject('headteacher', 'headteacher');
    setProject('operations', 'avara');
    setText('#interests .section-head .text', content.interestsIntro);
    var interests = [
      ['gamingTitle', 'gamingDescription'],
      ['sportsTitle', 'sportsDescription'],
      ['musicTitle', 'musicDescription'],
      ['leadershipTitle', 'leadershipDescription']
    ];
    var cards = document.querySelectorAll('.interests-grid .interest-card');
    interests.forEach(function (keys, index) {
      if (!cards[index]) return;
      var heading = cards[index].querySelector('h3');
      var paragraph = cards[index].querySelector('p');
      if (heading && typeof content[keys[0]] === 'string') heading.textContent = content[keys[0]];
      if (paragraph && typeof content[keys[1]] === 'string') paragraph.textContent = content[keys[1]];
    });
    setText('#socials > p.text', content.socialsIntro);
    setText('.discord-profile-copy h3', content.discordProfileTitle);
    setText('.discord-profile-copy p', content.discordProfileDescription);
    setUrl('.discord-profile-actions a.btn-main', content.discordProfileUrl, false);

    var socialKeys = [
      'socialRobloxUrl',
      'socialDiscordUrl',
      'socialTikTokUrl',
      'socialYouTubeUrl',
      'socialSnapchatUrl',
      'socialSignalUrl'
    ];
    var socialLinks = document.querySelectorAll('#socials .links a.link');
    socialKeys.forEach(function (key, index) {
      if (socialLinks[index]) setUrl('#socials .links a.link:nth-child(' + (index + 1) + ')', content[key], false);
    });

    var description = document.querySelector('meta[name="description"]');
    if (description && typeof content.siteDescription === 'string') description.content = content.siteDescription;
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && typeof content.siteTitle === 'string') ogTitle.content = content.siteTitle;
    var ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && typeof content.siteDescription === 'string') ogDescription.content = content.siteDescription;

    var brand = document.querySelector('.logo');
    if (brand && typeof content.heroName === 'string') {
      Array.prototype.forEach.call(brand.childNodes, function (node) {
        if (node.nodeType === 3) node.nodeValue = content.heroName.replace(/\.$/, '');
      });
    }
  }

  fetch('/api/site-content', {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  }).then(function (response) {
    if (!response.ok) throw new Error('Website content unavailable');
    return response.json();
  }).then(function (data) {
    applyContent(data.content);
  }).catch(function () {
    // The original HTML remains a usable fallback if the content API is unavailable.
  });
})();
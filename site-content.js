(function () {
  'use strict';

  function setText(selector, value) {
    if (typeof value !== 'string') return;
    var node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function setLeadingText(selector, value) {
    if (typeof value !== 'string') return;
    var node = document.querySelector(selector);
    if (!node) return;
    var textNode = Array.prototype.slice.call(node.childNodes).find(function (child) {
      return child.nodeType === 3 && child.nodeValue.trim();
    });
    if (textNode) textNode.nodeValue = ' ' + value;
    else node.appendChild(document.createTextNode(value));
  }

  function setAnchor(selector, value) {
    var node = document.querySelector(selector);
    var allowed = ['#about', '#games', '#roblox', '#projects', '#interests', '#reviews', '#socials'];
    if (!node || typeof value !== 'string') return;
    if (allowed.includes(value)) node.setAttribute('href', value);
  }

  function setProject(prefix, keyPrefix, content) {
    setText('.project-' + prefix + ' .project-tag', content[keyPrefix + 'Tag']);
    setText('.project-' + prefix + ' h3', content[keyPrefix + 'Title']);
    setText('.project-' + prefix + ' > p', content[keyPrefix + 'Description']);
    setLeadingText('.project-' + prefix + ' .project-links a', content[keyPrefix + 'LinkLabel']);
    setUrl('.project-' + prefix + ' .project-links a', content[keyPrefix + 'Url'], true);
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
    setLeadingText('.hero .eyebrow', content.heroEyebrow);
    setText('.hero .intro', content.heroIntro);
    setLeadingText('.hero .btns a.btn-main', content.heroPrimaryCta);
    setAnchor('.hero .btns a.btn-main', content.heroPrimaryHref);
    setLeadingText('.hero .btns a.btn-line', content.heroSecondaryCta);
    setAnchor('.hero .btns a.btn-line', content.heroSecondaryHref);
    setLeadingText('.hero .hero-meta span:nth-child(1)', content.heroMetaOne);
    setLeadingText('.hero .hero-meta span:nth-child(2)', content.heroMetaTwo);
    setLeadingText('.hero .hero-meta span:nth-child(3)', content.heroMetaThree);
    setLeadingText('#about .section-head .section-kicker', content.aboutKicker);
    setText('#about .section-head h2', content.aboutHeading);
    setText('#about .about-grid > .text', content.aboutText);
    setText('.about-note strong', content.aboutNoteTitle);
    setText('.about-note p', content.aboutNoteText);
    setLeadingText('#games > .section-kicker', content.gamesKicker);
    setText('#games h2', content.gamesHeading);
    setText('#games > p.text', content.gamesIntro);
    var gameKeys = [
      ['gameOneTitle', 'gameOneDescription', 'gameOneType'],
      ['gameTwoTitle', 'gameTwoDescription', 'gameTwoType'],
      ['gameThreeTitle', 'gameThreeDescription', 'gameThreeType']
    ];
    var gameRows = document.querySelectorAll('#games .games > li');
    gameKeys.forEach(function (keys, index) {
      if (!gameRows[index]) return;
      setText('#games .games > li:nth-child(' + (index + 1) + ') h3', content[keys[0]]);
      setText('#games .games > li:nth-child(' + (index + 1) + ') p', content[keys[1]]);
      setText('#games .games > li:nth-child(' + (index + 1) + ') .type', content[keys[2]]);
    });
    setLeadingText('#roblox > .section-kicker', content.robloxKicker);
    setText('#roblox h2', content.robloxHeading);
    setText('#roblox > p.text', content.robloxIntro);
    setLeadingText('#projects .section-head .section-kicker', content.experienceKicker);
    setText('#projects .section-head h2', content.experienceHeading);
    setText('#projects .section-head .text', content.experienceIntro);
    setProject('kfc', 'kfc', content);
    setProject('headteacher', 'headteacher', content);
    setProject('operations', 'avara', content);
    setLeadingText('#interests .section-head .section-kicker', content.interestsKicker);
    setText('#interests .section-head h2', content.interestsHeading);
    setText('#interests .section-head .text', content.interestsIntro);
    setLeadingText('#socials .section-kicker', content.socialsKicker);
    setText('#socials h2', content.socialsHeading);
    setText('#socials > p.text', content.socialsIntro);
    setLeadingText('#socials .links a.link:nth-child(1)', content.socialRobloxLabel);
    setLeadingText('#socials .links a.link:nth-child(2)', content.socialDiscordLabel);
    setLeadingText('#socials .links a.link:nth-child(3)', content.socialTikTokLabel);
    setLeadingText('#socials .links a.link:nth-child(4)', content.socialYouTubeLabel);
    setLeadingText('#socials .links a.link:nth-child(5)', content.socialSnapchatLabel);
    setLeadingText('#socials .links a.link:nth-child(6)', content.socialSignalLabel);
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
document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');
  const storageKeys = {
    session: 'booknest-demo-session',
    data: 'booknest-demo-data',
    theme: 'booknest-theme',
  };
  const demoCredentials = {
    email: 'admin@test.test',
    password: 'admin123',
    name: 'Khen Lim',
  };

  const applyTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(storageKeys.theme, theme);
    if (themeToggle) themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
  };

  applyTheme(localStorage.getItem(storageKeys.theme) || 'light');
  themeToggle?.addEventListener('click', () => {
    applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  const loginPage = window.location.pathname.endsWith('/login.html');
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem(storageKeys.session) || 'null');
  } catch {
    localStorage.removeItem(storageKeys.session);
  }

  if (loginPage) {
    if (session) {
      window.location.replace('index.html');
      return;
    }

    const form = document.querySelector('#login-form');
    const emailInput = document.querySelector('#login-email');
    const passwordInput = document.querySelector('#login-password');
    const error = document.querySelector('#login-error');

    document.querySelector('#use-demo')?.addEventListener('click', () => {
      emailInput.value = demoCredentials.email;
      passwordInput.value = demoCredentials.password;
      error.hidden = true;
      emailInput.focus();
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      if (email !== demoCredentials.email || password !== demoCredentials.password) {
        error.textContent = 'That demo email and password do not match. Use the demo account below.';
        error.hidden = false;
        return;
      }

      localStorage.setItem(storageKeys.session, JSON.stringify({
        email: demoCredentials.email,
        name: demoCredentials.name,
      }));
      window.location.assign('index.html');
    });
    return;
  }

  if (!session) {
    window.location.replace('login.html');
    return;
  }

  document.querySelectorAll('[data-logout]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      localStorage.removeItem(storageKeys.session);
      window.location.assign('login.html');
    });
  });

  document.querySelectorAll('.nav a').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.hasAttribute('data-logout')) return;
      document.querySelectorAll('.nav a').forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    });
  });

  const dateOffset = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };
  const daysAgo = (days) => dateOffset(-days);
  const initialData = {
    profile: {
      name: demoCredentials.name,
      email: demoCredentials.email,
      phone: '+1 (555) 014-2086',
    },
    books: [
      { id: 'bk-01', title: 'The Creative Act', author: 'Rick Rubin', category: 'Creativity', year: 2023, available: 2, total: 5 },
      { id: 'bk-02', title: 'Designing Your Life', author: 'Bill Burnett & Dave Evans', category: 'Design', year: 2016, available: 1, total: 4 },
      { id: 'bk-03', title: 'Atomic Habits', author: 'James Clear', category: 'Personal Growth', year: 2018, available: 0, total: 6 },
      { id: 'bk-04', title: 'The Design of Everyday Things', author: 'Don Norman', category: 'Design', year: 2013, available: 3, total: 5 },
      { id: 'bk-05', title: 'Educated', author: 'Tara Westover', category: 'Memoir', year: 2018, available: 2, total: 3 },
      { id: 'bk-06', title: 'Project Hail Mary', author: 'Andy Weir', category: 'Science Fiction', year: 2021, available: 4, total: 4 },
      { id: 'bk-07', title: 'The Midnight Library', author: 'Matt Haig', category: 'Fiction', year: 2020, available: 1, total: 4 },
      { id: 'bk-08', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', category: 'Psychology', year: 2011, available: 2, total: 3 },
    ],
    borrowed: [
      { bookId: 'bk-01', borrowedOn: daysAgo(12), dueOn: dateOffset(2) },
      { bookId: 'bk-02', borrowedOn: daysAgo(9), dueOn: dateOffset(5) },
      { bookId: 'bk-03', borrowedOn: daysAgo(7), dueOn: dateOffset(7) },
    ],
    history: [
      { bookId: 'bk-05', borrowedOn: daysAgo(48), returnedOn: daysAgo(34), status: 'Returned' },
      { bookId: 'bk-08', borrowedOn: daysAgo(82), returnedOn: daysAgo(68), status: 'Returned' },
      { bookId: 'bk-04', borrowedOn: daysAgo(120), returnedOn: daysAgo(102), status: 'Returned' },
      { bookId: 'bk-07', borrowedOn: daysAgo(155), returnedOn: daysAgo(138), status: 'Returned' },
    ],
  };

  let data;
  let needsSeed = true;
  try {
    const savedData = JSON.parse(localStorage.getItem(storageKeys.data) || 'null');
    if (savedData?.profile && Array.isArray(savedData.books)
      && Array.isArray(savedData.borrowed) && Array.isArray(savedData.history)) {
      data = savedData;
      needsSeed = false;
    } else {
      data = initialData;
    }
  } catch {
    data = initialData;
  }

  const saveData = () => localStorage.setItem(storageKeys.data, JSON.stringify(data));
  if (needsSeed) saveData();
  const findBook = (bookId) => data.books.find((book) => book.id === bookId);
  const prettyDate = (isoDate) => new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const daysUntil = (isoDate) => {
    const due = new Date(`${isoDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

  const bookInfoMarkup = (book) => `
    <div class="book-info">
      <div class="minicover" aria-hidden="true"></div>
      <div><div class="book-title">${escapeHtml(book.title)}</div><div class="book-author">${escapeHtml(book.author)}</div></div>
    </div>`;

  const renderCatalog = (grid, books) => {
    if (!grid) return;
    grid.replaceChildren();
    if (!books.length) {
      grid.innerHTML = '<div class="catalog-empty" role="status">No books match those filters. Try another search.</div>';
      return;
    }
    books.forEach((book) => {
      const card = document.createElement('article');
      card.className = 'catalog-card';
      card.dataset.bookId = book.id;
      card.innerHTML = `
        <div class="catalog-cover" aria-hidden="true"></div>
        <h3>${escapeHtml(book.title)}</h3>
        <div class="author">${escapeHtml(book.author)}</div>
        <div class="meta-row"><span>Category</span><span class="label">${escapeHtml(book.category)}</span></div>
        <div class="meta-row"><span>Available</span><span class="label">${book.available} / ${book.total}</span></div>
        <button class="btn primary" type="button" data-borrow="${book.id}" ${book.available < 1 ? 'disabled' : ''}>${book.available < 1 ? 'Checked out' : 'Borrow'}</button>`;
      grid.append(card);
    });
  };

  const renderBorrowed = (list) => {
    if (!list) return;
    list.replaceChildren();
    data.borrowed.forEach((record) => {
      const book = findBook(record.bookId);
      if (!book) return;
      const remaining = daysUntil(record.dueOn);
      const state = remaining < 0 ? 'Overdue' : remaining <= 3 ? 'Due soon' : 'On track';
      const tone = remaining < 0 ? 'danger' : remaining <= 3 ? 'warning' : 'success';
      const row = document.createElement('div');
      row.className = 'borrow-row';
      row.innerHTML = `${bookInfoMarkup(book)}
        <div><span class="pill ${tone} borrow-row-status" data-days-until="${remaining}">${state}</span></div>
        <div>${remaining < 0 ? `${Math.abs(remaining)} days overdue` : `Due in ${remaining} days`}</div>
        <div>${prettyDate(record.dueOn)}</div>
        <div class="table-actions"><button class="btn primary" type="button" data-return="${book.id}">Return</button></div>`;
      list.append(row);
    });
    if (!list.children.length) {
      list.innerHTML = '<div class="empty-state">No books are currently checked out. Browse the catalog to find your next read.</div>';
    }
  };

  const renderActivity = (list, records) => {
    if (!list) return;
    list.replaceChildren();
    records.forEach((record) => {
      const book = findBook(record.bookId);
      if (!book) return;
      const row = document.createElement('div');
      row.className = 'borrow-row';
      const isReturned = Boolean(record.returnedOn);
      const status = record.status || 'Returned';
      const tone = status === 'Returned' ? 'success' : status === 'Late' ? 'warning' : 'danger';
      row.innerHTML = `${bookInfoMarkup(book)}
        <div>${prettyDate(record.borrowedOn)}</div>
        <div>${isReturned ? prettyDate(record.returnedOn) : prettyDate(record.dueOn)}</div>
        <div>${isReturned ? status : 'Checked out'}</div>
        <div><span class="pill ${tone}">${isReturned ? 'Complete' : 'Open'}</span></div>`;
      list.append(row);
    });
    if (!list.children.length) {
      list.innerHTML = '<div class="catalog-empty">No borrowing history to show yet.</div>';
    }
  };

  const pageName = window.location.pathname.split('/').pop();
  const borrowed = data.borrowed;
  if (pageName === 'index.html' || pageName === '') {
    const heading = document.querySelector('.dashboard-wrap h1');
    if (heading) heading.textContent = `Welcome back, ${data.profile.name.split(' ')[0]}`;
    const counts = {
      Borrowed: borrowed.length,
      'Due soon': borrowed.filter((record) => daysUntil(record.dueOn) <= 3 && daysUntil(record.dueOn) >= 0).length,
      Overdue: borrowed.filter((record) => daysUntil(record.dueOn) < 0).length,
      Returned: data.history.length,
    };
    document.querySelectorAll('.stat-box').forEach((box) => {
      const label = box.querySelector('.label')?.textContent.trim();
      const value = box.querySelector('.value');
      if (label in counts && value) value.textContent = counts[label];
    });
    const strip = document.querySelector('.book-strip');
    if (strip) {
      strip.replaceChildren();
      borrowed.slice(0, 4).forEach((record) => {
        const book = findBook(record.bookId);
        if (!book) return;
        const tile = document.createElement('div');
        tile.className = 'book-tile';
        tile.innerHTML = `<div class="cover" aria-hidden="true"></div><div class="meta"><span class="tag">Due in ${Math.max(0, daysUntil(record.dueOn))} days</span><div class="borrowed-title">${escapeHtml(book.title)}</div><div>${escapeHtml(book.author)}</div></div>`;
        strip.append(tile);
      });
      if (!borrowed.length) {
        strip.innerHTML = '<div class="catalog-empty">You have no current loans. Browse the catalog to find your next read.</div>';
      }
    }
    renderCatalog(document.querySelector('.catalog-grid'), data.books.slice(0, 4));
  }

  if (pageName === 'browse.html') {
    renderCatalog(document.querySelector('.catalog-grid'), data.books);
    const recent = [...data.borrowed.map((record) => ({ ...record, status: 'Checked out' })), ...data.history]
      .sort((left, right) => right.borrowedOn.localeCompare(left.borrowedOn))
      .slice(0, 5);
    renderActivity(document.querySelector('.borrowed-list'), recent);
  }

  if (pageName === 'my-books.html') {
    renderBorrowed(document.querySelector('.borrowed-list'));
    const filterPills = document.querySelectorAll('.greeting-row .filters .pill');
    if (filterPills[0]) filterPills[0].textContent = `All (${borrowed.length})`;
    if (filterPills[1]) {
      const dueSoon = borrowed.filter((record) => daysUntil(record.dueOn) <= 3 && daysUntil(record.dueOn) >= 0).length;
      filterPills[1].textContent = `Due soon (${dueSoon})`;
    }
    document.querySelectorAll('[data-loan-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const dueSoonOnly = button.dataset.loanFilter === 'due-soon';
        document.querySelectorAll('[data-loan-filter]').forEach((filter) => {
          const active = filter === button;
          filter.classList.toggle('active', active);
          filter.setAttribute('aria-pressed', String(active));
        });
        document.querySelectorAll('.borrowed-list .borrow-row').forEach((row) => {
          const daysUntilDue = Number(row.querySelector('[data-days-until]')?.dataset.daysUntil ?? 999);
          row.hidden = dueSoonOnly && (daysUntilDue < 0 || daysUntilDue > 3);
        });
      });
    });
    const returnPanel = document.querySelector('.modal-box')?.closest('.panel');
    if (returnPanel) returnPanel.hidden = true;
  }

  if (pageName === 'history.html') {
    renderActivity(document.querySelector('.borrowed-list'), data.history);
    const filterPills = document.querySelectorAll('.greeting-row .filters .pill');
    if (filterPills[0]) filterPills[0].textContent = `All (${data.history.length})`;
  }

  if (pageName === 'profile.html') {
    const fields = document.querySelectorAll('.form-box .field input');
    if (fields[0]) fields[0].value = data.profile.name;
    if (fields[1]) fields[1].value = data.profile.email;
    if (fields[2]) fields[2].value = data.profile.phone;
    const emptyState = document.querySelector('.form-panel .empty-state');
    if (emptyState) {
      emptyState.innerHTML = `<div><div class="icon" aria-hidden="true"></div><div class="profile-summary-name">${escapeHtml(data.profile.name)}</div><div class="profile-summary-line">${escapeHtml(data.profile.email)}</div><div class="profile-summary-line">Member since September 2024 · Student member</div></div>`;
    }
    document.querySelector('#profile-form')?.addEventListener('reset', () => {
      window.setTimeout(() => {
        const fields = document.querySelectorAll('#profile-form .field input');
        if (fields[0]) fields[0].value = data.profile.name;
        if (fields[1]) fields[1].value = data.profile.email;
        if (fields[2]) fields[2].value = data.profile.phone;
        const notice = document.querySelector('#profile-notice');
        if (notice) notice.hidden = true;
      });
    });
    document.querySelector('#profile-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const fields = document.querySelectorAll('#profile-form .field input');
      data.profile = {
        name: fields[0].value.trim(),
        email: fields[1].value.trim(),
        phone: fields[2].value.trim(),
      };
      session = { ...session, name: data.profile.name, email: data.profile.email };
      localStorage.setItem(storageKeys.session, JSON.stringify(session));
      saveData();
      const notice = document.querySelector('#profile-notice');
      if (notice) {
        notice.textContent = 'Your demo profile has been updated.';
        notice.hidden = false;
      }
      const summary = document.querySelector('.profile-summary-name')?.parentElement;
      if (summary) {
        summary.querySelector('.profile-summary-name').textContent = data.profile.name;
        summary.querySelector('.profile-summary-line').textContent = data.profile.email;
      }
    });
  }

  const borrowBook = (bookId) => {
    const book = findBook(bookId);
    if (!book || book.available < 1 || borrowed.some((record) => record.bookId === bookId)) return;
    book.available -= 1;
    borrowed.push({ bookId, borrowedOn: dateOffset(0), dueOn: dateOffset(14) });
    saveData();
    window.location.assign('my-books.html');
  };

  const returnBook = (bookId) => {
    const index = borrowed.findIndex((record) => record.bookId === bookId);
    if (index < 0) return;
    const [record] = borrowed.splice(index, 1);
    const book = findBook(bookId);
    if (book) book.available = Math.min(book.total, book.available + 1);
    data.history.unshift({
      bookId,
      borrowedOn: record.borrowedOn,
      returnedOn: dateOffset(0),
      status: daysUntil(record.dueOn) < 0 ? 'Late' : 'Returned',
    });
    saveData();
    window.location.reload();
  };

  document.addEventListener('click', (event) => {
    const borrowButton = event.target.closest('[data-borrow]');
    if (borrowButton) borrowBook(borrowButton.dataset.borrow);

    const returnButton = event.target.closest('[data-return]');
    if (returnButton && window.confirm('Return this book to the library?')) {
      returnBook(returnButton.dataset.return);
    }

    if (event.target.closest('.dashboard-wrap .greeting-row .btn.primary')) {
      window.location.assign('browse.html');
    }

  });

  document.querySelectorAll('.search-bar').forEach((bar) => {
    const input = bar.querySelector('.search-box');
    const searchButton = bar.querySelector('.btn.primary');
    if (!input || !document.querySelector('.catalog-grid')) return;
    input.value = '';
    if (pageName !== 'browse.html') input.placeholder = 'Search by title, author, or category';
    const filterBooks = () => {
      const query = input.value.trim().toLowerCase();
      const selectedCategory = document.querySelector('#category-filter')?.value || '';
      const selectedYear = Number(document.querySelector('#year-filter')?.value || 0);
      const matches = data.books.filter((book) => {
        const matchesText = `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query);
        return matchesText
          && (!selectedCategory || book.category === selectedCategory)
          && (!selectedYear || book.year >= selectedYear);
      });
      renderCatalog(document.querySelector('.catalog-grid'), pageName === 'index.html' ? matches.slice(0, 4) : matches);
    };
    input.addEventListener('input', filterBooks);
    searchButton?.addEventListener('click', filterBooks);
    bar.querySelectorAll('select').forEach((select) => select.addEventListener('change', filterBooks));
  });

  document.querySelectorAll('.catalog-card, .book-tile, .stat-box').forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = 'rgba(29, 29, 27, 0.22)';
      card.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.08)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '';
      card.style.boxShadow = '';
    });
  });
});

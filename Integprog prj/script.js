document.addEventListener('DOMContentLoaded', async () => {
  const html = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');
  const apiUrl = 'api.php';
  const roleHomes = {
    borrower: 'index.html',
    librarian: 'librarian.html',
    administrator: 'administrator.html',
  };

  const applyTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('booknest-theme', theme);
    if (themeToggle) themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
  };

  applyTheme(localStorage.getItem('booknest-theme') || 'light');
  themeToggle?.addEventListener('click', () => {
    applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  const request = async (action, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${apiUrl}?action=${encodeURIComponent(action)}`, {
      credentials: 'same-origin',
      ...options,
      headers,
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || 'The request could not be completed.');
      error.status = response.status;
      throw error;
    }
    return result;
  };

  const goToRoleHome = (role) => {
    window.location.replace(roleHomes[role] || 'login.html');
  };

  const loginPage = window.location.pathname.endsWith('/login.html');
  if (loginPage) {
    try {
      const data = await request('data');
      goToRoleHome(data.role);
      return;
    } catch (error) {
      if (error.status !== 401) {
        const message = document.querySelector('#login-error');
        if (message) {
          message.textContent = error.message;
          message.hidden = false;
        }
      }
    }

    const form = document.querySelector('#login-form');
    const signupForm = document.querySelector('#signup-form');
    const emailInput = document.querySelector('#login-email');
    const passwordInput = document.querySelector('#login-password');
    const errorMessage = document.querySelector('#login-error');
    const signupError = document.querySelector('#signup-error');
    const toggleAuthMode = document.querySelector('#toggle-auth-mode');
    const switchPrompt = document.querySelector('#login-switch-prompt');
    const heading = document.querySelector('#login-heading');
    const intro = document.querySelector('#login-intro');
    const demoAccess = document.querySelector('#demo-access');

    toggleAuthMode?.addEventListener('click', () => {
      const showingSignup = signupForm.hidden;
      signupForm.hidden = !showingSignup;
      form.hidden = showingSignup;
      demoAccess.hidden = showingSignup;
      heading.textContent = showingSignup ? 'Create your account' : 'Welcome to BookNest';
      intro.textContent = showingSignup
        ? 'Create an account to start borrowing books.'
        : 'Sign in to manage your reading and borrowing.';
      switchPrompt.textContent = showingSignup ? 'Already have an account?' : 'New to BookNest?';
      toggleAuthMode.textContent = showingSignup ? 'Sign in' : 'Create an account';
      errorMessage.hidden = true;
      signupError.hidden = true;
    });

    document.querySelector('#use-demo')?.addEventListener('click', () => {
      emailInput.value = 'admin@test.test';
      passwordInput.value = 'admin123';
      errorMessage.hidden = true;
      emailInput.focus();
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      errorMessage.hidden = true;
      try {
        const result = await request('login', {
          method: 'POST',
          body: JSON.stringify({
            email: emailInput.value.trim(),
            password: passwordInput.value,
          }),
        });
        goToRoleHome(result.role);
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });

    signupForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = document.querySelector('#signup-name');
      const signupEmail = document.querySelector('#signup-email');
      const signupPassword = document.querySelector('#signup-password');
      const confirmPassword = document.querySelector('#signup-confirm-password');
      const submit = signupForm.querySelector('[type="submit"]');
      signupError.hidden = true;
      if (signupPassword.value !== confirmPassword.value) {
        signupError.textContent = 'The passwords do not match.';
        signupError.hidden = false;
        confirmPassword.focus();
        return;
      }

      submit.disabled = true;
      try {
        const result = await request('signup', {
          method: 'POST',
          body: JSON.stringify({
            name: nameInput.value.trim(),
            email: signupEmail.value.trim(),
            password: signupPassword.value,
          }),
        });
        goToRoleHome(result.role);
      } catch (error) {
        signupError.textContent = error.message;
        signupError.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
    return;
  }

  document.querySelectorAll('[data-logout]').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await request('logout', { method: 'POST', body: '{}' });
        window.location.assign('login.html');
      } catch (error) {
        showPageError(error.message);
      }
    });
  });

  document.querySelectorAll('.nav a').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.hasAttribute('data-logout')) return;
      document.querySelectorAll('.nav a').forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    });
  });
  function showPageError(message) {
    let notice = document.querySelector('#page-error');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'page-error';
      notice.className = 'form-notice';
      notice.setAttribute('role', 'alert');
      document.querySelector('.content')?.prepend(notice);
    }
    if (notice) {
      notice.textContent = message;
      notice.hidden = false;
    }
  }

  function setNotice(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('notice-error', isError);
    element.hidden = false;
  }

  let data;
  try {
    data = await request('data');
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      window.location.replace('login.html');
      return;
    }
    showPageError(error.message);
    return;
  }

  const pageName = window.location.pathname.split('/').pop();
  const borrowerPages = ['index.html', '', 'browse.html', 'my-books.html', 'history.html', 'profile.html', 'change-password.html'];
  const librarianPages = [
    'librarian.html',
    'librarian-catalog.html',
    'librarian-reservations.html',
    'librarian-loans.html',
    'librarian-borrowers.html',
  ];
  const administratorPages = [
    'administrator.html',
    'administrator-rules.html',
    'administrator-staff.html',
    'administrator-users.html',
  ];
  if ((borrowerPages.includes(pageName) && data.role !== 'borrower')
      || (librarianPages.includes(pageName) && !['librarian', 'administrator'].includes(data.role))
      || (administratorPages.includes(pageName) && data.role !== 'administrator')) {
    goToRoleHome(data.role);
    return;
  }

  const dateOffset = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };
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
  const money = (amount) => `₱${Number(amount || 0).toFixed(2)}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const findBook = (bookId, books = data.books) => books.find((book) => book.id === bookId);

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
      const alreadyBorrowed = data.borrowed.some((loan) => loan.bookId === book.id);
      const activeRequest = data.reservations.find((reservation) => reservation.book_code === book.id);
      const disabled = alreadyBorrowed || Boolean(activeRequest);
      const buttonText = alreadyBorrowed ? 'On loan' : activeRequest ? `Request ${activeRequest.status}` : 'Request book';
      card.innerHTML = `
        <div class="catalog-cover" aria-hidden="true"></div>
        <h3>${escapeHtml(book.title)}</h3>
        <div class="author">${escapeHtml(book.author)}</div>
        <div class="meta-row"><span>Subject</span><span class="label">${escapeHtml(book.subject || book.category)}</span></div>
        <div class="meta-row"><span>ISBN</span><span class="label">${escapeHtml(book.isbn || 'Not listed')}</span></div>
        <div class="meta-row"><span>Available</span><span class="label">${book.available} / ${book.total}</span></div>
        <button class="btn primary" type="button" data-request="${escapeHtml(book.id)}" ${disabled ? 'disabled' : ''}>${buttonText}</button>`;
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
      const canRenew = record.renewalsUsed < data.rules.renewalLimit && remaining >= 0;
      const row = document.createElement('div');
      row.className = 'role-row';
      row.innerHTML = `
        ${bookInfoMarkup(book)}
        <div><span class="pill ${tone}">${state}</span><div class="role-row-meta">Due ${prettyDate(record.dueOn)}</div></div>
        <div class="role-row-meta">Renewals ${record.renewalsUsed} / ${data.rules.renewalLimit}</div>
        <div class="role-row-meta">Estimated fine ${money(record.fineAmount)}</div>
        <div class="role-actions"><button class="btn primary" type="button" data-renew="${record.loanId}" ${canRenew ? '' : 'disabled'}>Renew</button></div>`;
      list.append(row);
    });
    if (!list.children.length) {
      list.innerHTML = '<div class="role-empty">No active loans. Browse the catalog to request a book.</div>';
    }
  };

  const renderActivity = (list, records) => {
    if (!list) return;
    list.replaceChildren();
    records.forEach((record) => {
      const book = findBook(record.bookId);
      if (!book) return;
      const row = document.createElement('div');
      row.className = 'role-row';
      const isReturned = Boolean(record.returnedOn);
      row.innerHTML = `
        ${bookInfoMarkup(book)}
        <div class="role-row-meta">Borrowed ${prettyDate(record.borrowedOn)}</div>
        <div class="role-row-meta">${isReturned ? `Returned ${prettyDate(record.returnedOn)}` : `Due ${prettyDate(record.dueOn)}`}</div>
        <div><span class="pill ${record.status === 'Late' ? 'warning' : 'success'}">${escapeHtml(record.status || 'On loan')}</span></div>
        <div class="role-row-meta">${record.fineAmount && Number(record.fineAmount) > 0 ? `Estimated fine ${money(record.fineAmount)}` : ''}</div>`;
      list.append(row);
    });
    if (!list.children.length) {
      list.innerHTML = '<div class="role-empty">No borrowing history to show yet.</div>';
    }
  };

  const setStats = (overview) => {
    document.querySelectorAll('[data-stat]').forEach((element) => {
      const key = element.dataset.stat;
      if (key in overview) element.textContent = overview[key];
    });
  };

  if (pageName === 'index.html' || pageName === '') {
    const heading = document.querySelector('.dashboard-wrap h1');
    if (heading) heading.textContent = `Welcome back, ${data.profile.name.split(' ')[0]}`;
    const dueSoon = data.borrowed.filter((loan) => {
      const remaining = daysUntil(loan.dueOn);
      return remaining >= 0 && remaining <= 3;
    }).length;
    const overdue = data.borrowed.filter((loan) => daysUntil(loan.dueOn) < 0).length;
    const dashboardCounts = {
      Borrowed: data.borrowed.length,
      'Due soon': dueSoon,
      Overdue: overdue,
      'Fine estimate (₱)': money(data.fineTotal),
    };
    document.querySelectorAll('.stat-box').forEach((box) => {
      const label = box.querySelector('.label')?.textContent.trim();
      const value = box.querySelector('.value');
      if (label in dashboardCounts && value) value.textContent = dashboardCounts[label];
    });
    const strip = document.querySelector('.book-strip');
    if (strip) {
      strip.replaceChildren();
      data.borrowed.slice(0, 4).forEach((record) => {
        const book = findBook(record.bookId);
        if (!book) return;
        const tile = document.createElement('div');
        tile.className = 'book-tile';
        tile.innerHTML = `<div class="cover" aria-hidden="true"></div><div class="meta"><span class="tag">Due in ${Math.max(0, daysUntil(record.dueOn))} days</span><div class="borrowed-title">${escapeHtml(book.title)}</div><div>${escapeHtml(book.author)}</div></div>`;
        strip.append(tile);
      });
      if (!data.borrowed.length) {
        strip.innerHTML = '<div class="catalog-empty">No current loans. Browse books and request a title to get started.</div>';
      }
    }
    renderCatalog(document.querySelector('.catalog-grid'), data.books.slice(0, 4));
  }

  if (pageName === 'browse.html') {
    renderCatalog(document.querySelector('.catalog-grid'), data.books);
    const recent = [...data.borrowed.map((record) => ({ ...record, status: 'On loan' })), ...data.history]
      .sort((left, right) => right.borrowedOn.localeCompare(left.borrowedOn))
      .slice(0, 5);
    renderActivity(document.querySelector('.borrowed-list'), recent);
  }

  if (pageName === 'my-books.html') {
    renderBorrowed(document.querySelector('.borrowed-list'));
    const requestList = document.querySelector('#my-reservations');
    if (requestList) {
      requestList.replaceChildren();
      data.reservations.forEach((reservation) => {
        const row = document.createElement('div');
        row.className = 'role-row';
        row.innerHTML = `
          <div class="role-row-main">
            <div class="role-row-title">${escapeHtml(reservation.title)}</div>
            <div class="role-row-meta">Requested ${prettyDate(reservation.requested_at.slice(0, 10))}</div>
          </div>
          <span class="pill ${reservation.status === 'approved' ? 'success' : 'warning'}">${escapeHtml(reservation.status)}</span>`;
        requestList.append(row);
      });
      if (!requestList.children.length) {
        requestList.innerHTML = '<div class="role-empty">No active book requests.</div>';
      }
    }
    const filterPills = document.querySelectorAll('.greeting-row .filters .pill');
    if (filterPills[0]) filterPills[0].textContent = `All (${data.borrowed.length})`;
    if (filterPills[1]) {
      const dueSoon = data.borrowed.filter((record) => {
        const remaining = daysUntil(record.dueOn);
        return remaining >= 0 && remaining <= 3;
      }).length;
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
        document.querySelectorAll('.borrowed-list .role-row').forEach((row) => {
          const dueText = row.querySelector('.pill')?.textContent;
          row.hidden = dueSoonOnly && dueText !== 'Due soon';
        });
      });
    });
  }

  if (pageName === 'history.html') {
    renderActivity(document.querySelector('.borrowed-list'), data.history);
  }

  if (pageName === 'profile.html') {
    const nameField = document.querySelector('#profile-name');
    const emailField = document.querySelector('#profile-email');
    const phoneField = document.querySelector('#profile-phone');
    const photoInput = document.querySelector('#profile-photo-input');
    const photoRemove = document.querySelector('#profile-photo-remove');
    const roleLabels = {
      borrower: 'Borrower account',
      librarian: 'Librarian account',
      administrator: 'Administrator account',
    };
    const renderProfile = () => {
      document.querySelector('#profile-display-name').textContent = data.profile.name;
      document.querySelector('#profile-display-email').textContent = data.profile.email;
      document.querySelector('#profile-account-type').textContent = roleLabels[data.role] || 'Library account';
      const initials = data.profile.name.trim().split(/\s+/).slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase()).join('') || 'B';
      document.querySelector('#profile-initials').textContent = initials;
      const image = document.querySelector('#profile-avatar-image');
      image.hidden = !data.profile.photoUrl;
      if (data.profile.photoUrl) image.src = data.profile.photoUrl;
      photoRemove.hidden = !data.profile.photoUrl;
    };
    const setProfileFields = () => {
      nameField.value = data.profile.name;
      emailField.value = data.profile.email;
      phoneField.value = data.profile.phone || '';
    };
    setProfileFields();
    renderProfile();
    if (new URLSearchParams(window.location.search).get('password') === 'changed') {
      setNotice(document.querySelector('#profile-notice'), 'Your password has been changed.');
    }
    document.querySelector('#profile-form')?.addEventListener('reset', () => {
      window.setTimeout(() => {
        setProfileFields();
      });
    });
    document.querySelector('#profile-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const notice = document.querySelector('#profile-notice');
      try {
        const result = await request('profile', {
          method: 'PUT',
          body: JSON.stringify({
            name: nameField.value.trim(),
            email: emailField.value.trim(),
            phone: phoneField.value.trim(),
          }),
        });
        data.profile = result.profile;
        setProfileFields();
        renderProfile();
        setNotice(notice, 'Your profile has been updated.');
      } catch (error) {
        setNotice(notice, error.message, true);
      }
    });

    photoInput?.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;
      const notice = document.querySelector('#profile-photo-notice');
      const formData = new FormData();
      formData.append('photo', file);
      photoInput.disabled = true;
      try {
        const result = await request('profile-photo', { method: 'POST', body: formData });
        data.profile.photoUrl = result.photoUrl;
        renderProfile();
        setNotice(notice, 'Your profile picture has been updated.');
      } catch (error) {
        setNotice(notice, error.message, true);
      } finally {
        photoInput.disabled = false;
        photoInput.value = '';
      }
    });

    photoRemove?.addEventListener('click', async () => {
      photoRemove.disabled = true;
      try {
        await request('profile-photo', { method: 'DELETE' });
        data.profile.photoUrl = '';
        renderProfile();
        setNotice(document.querySelector('#profile-photo-notice'), 'Your profile picture has been removed.');
      } catch (error) {
        setNotice(document.querySelector('#profile-photo-notice'), error.message, true);
      } finally {
        photoRemove.disabled = false;
      }
    });
  }

  if (pageName === 'change-password.html') {
    const form = document.querySelector('#change-password-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const currentPassword = document.querySelector('#current-password');
      const newPassword = document.querySelector('#new-password');
      const confirmPassword = document.querySelector('#confirm-password');
      const notice = document.querySelector('#password-notice');
      if (newPassword.value !== confirmPassword.value) {
        setNotice(notice, 'The new passwords do not match.', true);
        confirmPassword.focus();
        return;
      }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await request('change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: currentPassword.value,
            newPassword: newPassword.value,
          }),
        });
        window.location.assign('profile.html?password=changed');
      } catch (error) {
        setNotice(notice, error.message, true);
      } finally {
        submit.disabled = false;
      }
    });
  }

  if (librarianPages.includes(pageName)) {
    const loadLibrarianData = async () => {
      const staffData = await request('librarian-data');
      setStats(staffData.overview);
      renderLibrarianCatalog(staffData.books);
      renderLibrarianReservations(staffData.reservations);
      renderLibrarianLoans(staffData.loans);
      renderMembers(staffData.members);
      return staffData;
    };

    const renderLibrarianCatalog = (books) => {
      const list = document.querySelector('#librarian-catalog');
      if (!list) return;
      list.replaceChildren();
      books.forEach((book) => {
        const row = document.createElement('div');
        row.className = 'role-row';
        row.innerHTML = `
          <div class="role-row-main">
            <div class="role-row-title">${escapeHtml(book.title)} ${book.archived ? '<span class="pill">Archived</span>' : ''}</div>
            <div class="role-row-meta">${escapeHtml(book.author)} · ${escapeHtml(book.subject)} · ISBN ${escapeHtml(book.isbn || 'not listed')}</div>
            <div class="role-row-meta">${book.available} available of ${book.total} copies</div>
          </div>
          <div class="role-actions">
            ${book.archived ? '' : `<button class="btn" type="button" data-edit-book="${escapeHtml(book.id)}">Edit</button><button class="btn" type="button" data-archive-book="${escapeHtml(book.id)}">Archive</button>`}
          </div>`;
        list.append(row);
      });
      if (!books.length) list.innerHTML = '<div class="role-empty">No catalog records.</div>';
    };

    const renderLibrarianReservations = (reservations) => {
      const list = document.querySelector('#librarian-reservations');
      if (!list) return;
      list.replaceChildren();
      reservations.forEach((reservation) => {
        const row = document.createElement('div');
        row.className = 'role-row';
        row.innerHTML = `
          <div class="role-row-main">
            <div class="role-row-title">${escapeHtml(reservation.title)}</div>
            <div class="role-row-meta">${escapeHtml(reservation.full_name)} · ${escapeHtml(reservation.email)} · ${prettyDate(reservation.requested_at.slice(0, 10))}</div>
          </div>
          <div class="role-actions">
            <span class="pill ${reservation.status === 'approved' ? 'success' : 'warning'}">${escapeHtml(reservation.status)}</span>
            ${reservation.status === 'pending' ? `<button class="btn primary" type="button" data-reservation="${reservation.id}" data-decision="approved">Approve</button><button class="btn" type="button" data-reservation="${reservation.id}" data-decision="rejected">Reject</button>` : ''}
            ${reservation.status === 'approved' ? `<button class="btn primary" type="button" data-issue="${reservation.id}">Issue book</button>` : ''}
          </div>`;
        list.append(row);
      });
      if (!reservations.length) list.innerHTML = '<div class="role-empty">No pending or approved reservation requests.</div>';
    };

    const renderLibrarianLoans = (loans) => {
      const list = document.querySelector('#librarian-loans');
      if (!list) return;
      list.replaceChildren();
      loans.forEach((loan) => {
        const row = document.createElement('div');
        row.className = 'role-row';
        const lateDays = Number(loan.late_days);
        row.innerHTML = `
          <div class="role-row-main">
            <div class="role-row-title">${escapeHtml(loan.title)}</div>
            <div class="role-row-meta">${escapeHtml(loan.full_name)} · ${escapeHtml(loan.email)}</div>
          </div>
          <div class="role-row-meta">Due ${prettyDate(loan.due_on)}${lateDays ? ` · ${lateDays} days overdue · Fine estimate ${money(lateDays * data.rules.fineRatePesos)}` : ''}</div>
          <div class="role-actions"><button class="btn primary" type="button" data-return-loan="${loan.id}">Check in</button></div>`;
        list.append(row);
      });
      if (!loans.length) list.innerHTML = '<div class="role-empty">There are no active loans.</div>';
    };

    const renderMembers = (members) => {
      const list = document.querySelector('#librarian-members');
      if (!list) return;
      list.replaceChildren();
      members.forEach((member) => {
        const row = document.createElement('div');
        row.className = 'role-row';
        row.innerHTML = `
          <div class="role-row-main">
            <div class="role-row-title">${escapeHtml(member.full_name)}</div>
            <div class="role-row-meta">${escapeHtml(member.email)}</div>
          </div>
          <span class="pill ${Number(member.is_active) ? 'success' : 'danger'}">${Number(member.is_active) ? 'Active' : 'Inactive'}</span>`;
        list.append(row);
      });
      if (!members.length) list.innerHTML = '<div class="role-empty">No borrower accounts yet.</div>';
    };

    const form = document.querySelector('#book-form');
    const notice = document.querySelector('#book-form-notice');
    const yearInput = document.querySelector('#book-year');
    if (yearInput) yearInput.value = new Date().getFullYear();
    if (form) {
      form.addEventListener('reset', () => {
        window.setTimeout(() => {
          document.querySelector('#book-id').value = '';
          form.querySelector('[type="submit"]').textContent = 'Save book';
          if (notice) notice.hidden = true;
        });
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const bookId = document.querySelector('#book-id').value;
        const body = {
          id: bookId,
          title: document.querySelector('#book-title').value.trim(),
          author: document.querySelector('#book-author').value.trim(),
          subject: document.querySelector('#book-subject').value.trim(),
          category: document.querySelector('#book-category').value.trim(),
          isbn: document.querySelector('#book-isbn').value.trim(),
          year: Number(document.querySelector('#book-year').value),
          total: Number(document.querySelector('#book-total').value),
        };
        try {
          await request('catalog-save', {
            method: bookId ? 'PUT' : 'POST',
            body: JSON.stringify(body),
          });
          form.reset();
          await loadLibrarianData();
          setNotice(notice, 'Catalog record saved.');
        } catch (error) {
          setNotice(notice, error.message, true);
        }
      });
    }

    let staffData;
    try {
      staffData = await loadLibrarianData();
    } catch (error) {
      showPageError(error.message);
      return;
    }

    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const editButton = target.closest('[data-edit-book]');
      if (editButton) {
        const book = findBook(editButton.dataset.editBook, staffData.books);
        if (!book) return;
        document.querySelector('#book-id').value = book.id;
        document.querySelector('#book-title').value = book.title;
        document.querySelector('#book-author').value = book.author;
        document.querySelector('#book-subject').value = book.subject;
        document.querySelector('#book-category').value = book.category;
        document.querySelector('#book-isbn').value = book.isbn;
        document.querySelector('#book-year').value = book.year;
        document.querySelector('#book-total').value = book.total;
        form.querySelector('[type="submit"]').textContent = 'Update book';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const archiveButton = target.closest('[data-archive-book]');
      if (archiveButton && window.confirm('Archive this book from the borrower catalog?')) {
        try {
          await request('catalog-archive', {
            method: 'POST',
            body: JSON.stringify({ bookId: archiveButton.dataset.archiveBook }),
          });
          staffData = await loadLibrarianData();
        } catch (error) {
          showPageError(error.message);
        }
        return;
      }
      const decisionButton = target.closest('[data-reservation]');
      if (decisionButton) {
        try {
          await request('reservation-decision', {
            method: 'POST',
            body: JSON.stringify({
              reservationId: Number(decisionButton.dataset.reservation),
              decision: decisionButton.dataset.decision,
            }),
          });
          staffData = await loadLibrarianData();
        } catch (error) {
          showPageError(error.message);
        }
        return;
      }
      const issueButton = target.closest('[data-issue]');
      if (issueButton) {
        try {
          await request('issue', {
            method: 'POST',
            body: JSON.stringify({ reservationId: Number(issueButton.dataset.issue) }),
          });
          staffData = await loadLibrarianData();
        } catch (error) {
          showPageError(error.message);
        }
        return;
      }
      const returnButton = target.closest('[data-return-loan]');
      if (returnButton && window.confirm('Check in this book?')) {
        try {
          await request('return', {
            method: 'POST',
            body: JSON.stringify({ loanId: Number(returnButton.dataset.returnLoan) }),
          });
          staffData = await loadLibrarianData();
        } catch (error) {
          showPageError(error.message);
        }
      }
    });
  }

  if (administratorPages.includes(pageName)) {
    const renderAdminUsers = (users) => {
      const list = document.querySelector('#administrator-users');
      if (!list) return;
      list.replaceChildren();
      users.forEach((user) => {
        const row = document.createElement('div');
        row.className = 'role-row';
        row.dataset.userId = user.id;
        row.innerHTML = `
          <div class="role-row-main">
            <div class="role-row-title">${escapeHtml(user.full_name)}</div>
            <div class="role-row-meta">${escapeHtml(user.email)} · Joined ${prettyDate(user.created_at.slice(0, 10))}</div>
          </div>
          <div class="role-user-controls">
            <select aria-label="Role for ${escapeHtml(user.email)}" data-user-role>
              <option value="borrower" ${user.role === 'borrower' ? 'selected' : ''}>Borrower</option>
              <option value="librarian" ${user.role === 'librarian' ? 'selected' : ''}>Librarian</option>
              <option value="administrator" ${user.role === 'administrator' ? 'selected' : ''}>Administrator</option>
            </select>
            <select aria-label="Status for ${escapeHtml(user.email)}" data-user-status>
              <option value="active" ${Number(user.is_active) ? 'selected' : ''}>Active</option>
              <option value="inactive" ${Number(user.is_active) ? '' : 'selected'}>Inactive</option>
            </select>
            <button class="btn" type="button" data-save-user>Save</button>
          </div>`;
        list.append(row);
      });
      if (!users.length) list.innerHTML = '<div class="role-empty">No user accounts.</div>';
    };

    const loadAdminData = async () => {
      const adminData = await request('admin-data');
      setStats(adminData.overview);
      const estimatedFines = document.querySelector('#estimated-fines');
      if (estimatedFines) estimatedFines.textContent = money(adminData.estimatedFinesPesos);
      const loanPeriod = document.querySelector('#rule-loan-period');
      if (loanPeriod) loanPeriod.value = adminData.rules.loanPeriodDays;
      const maxLoans = document.querySelector('#rule-max-loans');
      if (maxLoans) maxLoans.value = adminData.rules.maxActiveLoans;
      const renewalLimit = document.querySelector('#rule-renewal-limit');
      if (renewalLimit) renewalLimit.value = adminData.rules.renewalLimit;
      const fineRate = document.querySelector('#rule-fine-rate');
      if (fineRate) fineRate.value = adminData.rules.fineRatePesos;
      renderAdminUsers(adminData.users);
      return adminData;
    };

    try {
      await loadAdminData();
    } catch (error) {
      showPageError(error.message);
      return;
    }

    document.querySelector('#rules-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const notice = document.querySelector('#rules-notice');
      try {
        await request('rules', {
          method: 'PUT',
          body: JSON.stringify({
            loanPeriodDays: Number(document.querySelector('#rule-loan-period').value),
            maxActiveLoans: Number(document.querySelector('#rule-max-loans').value),
            renewalLimit: Number(document.querySelector('#rule-renewal-limit').value),
            fineRatePesos: Number(document.querySelector('#rule-fine-rate').value),
          }),
        });
        setNotice(notice, 'Library rules saved.');
      } catch (error) {
        setNotice(notice, error.message, true);
      }
    });

    document.querySelector('#staff-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const notice = document.querySelector('#staff-notice');
      try {
        await request('staff-create', {
          method: 'POST',
          body: JSON.stringify({
            name: document.querySelector('#staff-name').value.trim(),
            email: document.querySelector('#staff-email').value.trim(),
            password: document.querySelector('#staff-password').value,
            role: document.querySelector('#staff-role').value,
          }),
        });
        form.reset();
        await loadAdminData();
        setNotice(notice, 'Staff account created.');
      } catch (error) {
        setNotice(notice, error.message, true);
      }
    });

    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const saveButton = target.closest('[data-save-user]');
      if (!saveButton) return;
      const row = saveButton.closest('[data-user-id]');
      try {
        await request('user-update', {
          method: 'PUT',
          body: JSON.stringify({
            userId: Number(row.dataset.userId),
            role: row.querySelector('[data-user-role]').value,
            isActive: row.querySelector('[data-user-status]').value === 'active',
          }),
        });
        await loadAdminData();
        showPageError('User account updated.');
        document.querySelector('#page-error').classList.remove('notice-error');
      } catch (error) {
        showPageError(error.message);
        document.querySelector('#page-error')?.classList.add('notice-error');
      }
    });
  }

  if (pageName === 'my-books.html') {
    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const renewButton = target.closest('[data-renew]');
      if (!renewButton) return;
      try {
        await request('renew', {
          method: 'POST',
          body: JSON.stringify({ loanId: Number(renewButton.dataset.renew) }),
        });
        window.location.reload();
      } catch (error) {
        showPageError(error.message);
      }
    });
  }

  if (pageName === 'index.html' || pageName === '' || pageName === 'browse.html') {
    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const requestButton = target.closest('[data-request]');
      if (requestButton) {
        try {
          await request('request', {
            method: 'POST',
            body: JSON.stringify({ bookId: requestButton.dataset.request }),
          });
          window.location.assign('my-books.html');
        } catch (error) {
          showPageError(error.message);
        }
        return;
      }
      if (target.closest('.dashboard-wrap .greeting-row .btn.primary')) {
        window.location.assign('browse.html');
      }
    });
  }

  document.querySelectorAll('.search-bar').forEach((bar) => {
    const input = bar.querySelector('.search-box');
    const searchButton = bar.querySelector('.btn.primary');
    const catalogGrid = document.querySelector('.catalog-grid');
    if (!input || !catalogGrid) return;
    input.value = '';
    input.placeholder = 'Search title, author, subject, or ISBN';
    const filterBooks = () => {
      const query = input.value.trim().toLowerCase();
      const selectedCategory = document.querySelector('#category-filter')?.value || '';
      const selectedYear = Number(document.querySelector('#year-filter')?.value || 0);
      const matches = data.books.filter((book) => {
        const searchable = `${book.title} ${book.author} ${book.subject} ${book.category} ${book.isbn}`.toLowerCase();
        return searchable.includes(query)
          && (!selectedCategory || book.category === selectedCategory)
          && (!selectedYear || book.year >= selectedYear);
      });
      renderCatalog(catalogGrid, pageName === 'index.html' ? matches.slice(0, 4) : matches);
    };
    input.addEventListener('input', filterBooks);
    searchButton?.addEventListener('click', filterBooks);
    bar.querySelectorAll('select').forEach((select) => select.addEventListener('change', filterBooks));
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');

  const applyTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('booknest-theme', theme);

    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
    }
  };

  const savedTheme = localStorage.getItem('booknest-theme') || 'light';
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  const navLinks = document.querySelectorAll('.nav a');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    });
  });

  const primaryButtons = document.querySelectorAll('.btn.primary');
  primaryButtons.forEach((button) => {
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 12px 24px rgba(31, 127, 232, 0.25)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = '';
      button.style.boxShadow = '';
    });
  });

  document.querySelectorAll('.catalog-card, .book-tile, .stat-box').forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = 'rgba(31, 127, 232, 0.5)';
      card.style.boxShadow = '0 12px 24px rgba(17, 19, 21, 0.08)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '';
      card.style.boxShadow = '';
    });
  });

  const actionButtons = document.querySelectorAll('.btn:not(.primary)');
  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      button.classList.toggle('pressed');
    });
  });
});

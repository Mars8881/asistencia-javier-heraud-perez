/* ============================================================
   Sistema de Asistencia QR - I.E. Javier Heraud Pérez
   Lógica de interfaz (funciona en modo local y Supabase)
   ============================================================ */

(function () {
  'use strict';

  var selectedRole = null;
  var pendingCode = null;
  var currentUser = null;
  var sessionsCache = [];
  var toastTimer = null;

  /* ================= Utilidades ================= */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-PE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  }

  function toast(message, type) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast show ' + (type || 'info');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.className = 'toast';
    }, 3600);
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = label || 'Procesando…';
      button.disabled = true;
    } else {
      if (button.dataset.label) button.textContent = button.dataset.label;
      button.disabled = false;
    }
  }

  /* ================= Navegación y sesión ================= */

  function showView(id) {
    $$('.view').forEach(function (view) {
      view.classList.toggle('active', view.id === id);
    });
  }

  function updateHeader() {
    var headerUser = $('#headerUser');
    var logoutBtn = $('#logoutBtn');

    if (currentUser) {
      headerUser.textContent = currentUser.name + ' · ' + capitalize(currentUser.role);
      headerUser.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      headerUser.classList.add('hidden');
      logoutBtn.classList.add('hidden');
    }
  }

  function applyMode() {
    var cloud = JHP_DB.isCloud();
    var badge = $('#modeBadge');

    badge.textContent = cloud ? 'Supabase' : 'Demo local';
    badge.classList.toggle('cloud', cloud);
    badge.title = cloud ? 'Datos guardados en la nube' : 'Datos guardados en este navegador';

    $$('.cloud-only').forEach(function (el) {
      el.classList.toggle('hidden', !cloud);
    });

    if (cloud) {
      $('#loginCodeField').style.display = 'none';
      $('#loginHint').textContent = 'Ingrese su correo y contraseña. Si es su primera vez, la cuenta se crea automáticamente.';
      $('#loginEmail').required = true;
      $('#loginPassword').required = true;
      $('#resetDemoBtn').classList.add('hidden');
    }
  }

  async function route() {
    if (!currentUser) {
      try {
        currentUser = await JHP_DB.currentUser();
      } catch (e) {
        currentUser = null;
      }
    }

    updateHeader();

    if (!currentUser) {
      showView('view-login');
      return;
    }

    try {
      if (currentUser.role === 'docente') {
        await renderDocente();
        showView('view-docente');
      } else {
        await renderEstudiante();
        showView('view-estudiante');
      }
    } catch (err) {
      console.error(err);
      toast('No se pudieron cargar los datos. Verifique su conexión.', 'error');
    }
  }

  /* ================= Login ================= */

  function bindLogin() {
    $$('.role-card').forEach(function (card) {
      card.addEventListener('click', function () {
        selectedRole = card.getAttribute('data-role');

        $$('.role-card').forEach(function (c) {
          c.classList.toggle('selected', c === card);
        });

        var form = $('#loginForm');
        form.classList.remove('hidden');
        form.classList.remove('fade-in');
        void form.offsetWidth;
        form.classList.add('fade-in');

        $('#loginTitle').textContent = selectedRole === 'docente' ? 'Acceso docente' : 'Acceso estudiante';
        $('#loginCodeField').style.display = selectedRole === 'docente' && !JHP_DB.isCloud() ? '' : 'none';

        setTimeout(function () {
          $('#loginName').focus();
        }, 120);
      });
    });

    $('#loginForm').addEventListener('submit', onLogin);
    $('#logoutBtn').addEventListener('click', onLogout);
  }

  async function onLogin(event) {
    event.preventDefault();

    if (!selectedRole) {
      toast('Seleccione un rol para continuar', 'error');
      return;
    }

    var name = $('#loginName').value.trim();
    if (!name) {
      toast('Ingrese su nombre completo', 'error');
      return;
    }

    var payload = { name: name, role: selectedRole };

    if (JHP_DB.isCloud()) {
      var email = $('#loginEmail').value.trim();
      var password = $('#loginPassword').value;

      if (!email || !password) {
        toast('Ingrese su correo y contraseña', 'error');
        return;
      }

      payload.email = email;
      payload.password = password;
    }

    var button = $('#loginSubmitBtn');

    try {
      setBusy(button, true, 'Ingresando…');
      currentUser = await JHP_DB.authenticate(payload);
      toast('Bienvenido(a), ' + currentUser.name, 'success');
      await route();
    } catch (err) {
      console.error(err);
      var message = err && err.message ? err.message : 'No se pudo iniciar sesión';

      if (/Invalid login credentials/i.test(message)) {
        message = 'Correo o contraseña incorrectos.';
      } else if (/Email not confirmed/i.test(message)) {
        message = 'Debe confirmar su correo o desactivar la confirmación de email en Supabase.';
      } else if (/already registered/i.test(message)) {
        message = 'Ese correo ya está registrado. Verifique su contraseña.';
      }

      toast(message, 'error');
    } finally {
      setBusy(button, false);
    }
  }

  async function onLogout() {
    try {
      await JHP_DB.signOut();
    } catch (e) {
      /* ignorar */
    }

    currentUser = null;
    selectedRole = null;
    pendingCode = null;

    $$('.role-card').forEach(function (c) { c.classList.remove('selected'); });
    $('#loginForm').classList.add('hidden');
    $('#loginName').value = '';
    $('#loginCode').value = '';
    $('#loginEmail').value = '';
    $('#loginPassword').value = '';

    updateHeader();
    showView('view-login');
    toast('Sesión cerrada', 'info');
  }

  /* ================= Panel DOCENTE ================= */

  async function renderDocente() {
    var sessions = await JHP_DB.listSessions();
    var rows = await JHP_DB.listAttendance();

    sessionsCache = sessions;

    $('#docWelcome').textContent = 'Bienvenido, ' + currentUser.name + '. Gestione sus clases y asistencias.';

    var today = new Date().toDateString();
    var unique = {};

    rows.forEach(function (row) {
      unique[String(row.studentName).trim().toLowerCase()] = true;
    });

    $('#docStatSessions').textContent = sessions.filter(function (s) {
      return s.status === 'active';
    }).length;
    $('#docStatAttendance').textContent = rows.length;
    $('#docStatToday').textContent = rows.filter(function (row) {
      return new Date(row.timestamp).toDateString() === today;
    }).length;
    $('#docStatStudents').textContent = Object.keys(unique).length;

    renderSessionsTable(sessions);
    renderAttendanceFilterOptions(sessions);
    renderAttendanceTable(rows);
  }

  function renderSessionsTable(sessions) {
    var tbody = $('#sessionsTable tbody');
    tbody.innerHTML = '';

    $('#sessionsEmpty').classList.toggle('hidden', sessions.length > 0);
    $('#sessionsTable').classList.toggle('hidden', sessions.length === 0);

    sessions.forEach(function (session) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + esc(session.subject) + '</strong></td>' +
        '<td>' + esc(session.grade) + ' ' + esc(session.section || '') + '</td>' +
        '<td><code class="code-pill">' + esc(session.code) + '</code></td>' +
        '<td>' + (session.attendanceCount || 0) + '</td>' +
        '<td><span class="badge ' + (session.status === 'active' ? 'badge-green' : 'badge-gray') + '">' +
          (session.status === 'active' ? 'Activa' : 'Finalizada') + '</span></td>' +
        '<td class="actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-qr="' + esc(session.code) + '">Ver QR</button>' +
          (session.status === 'active'
            ? '<button type="button" class="btn btn-ghost btn-sm danger" data-close="' + esc(session.code) + '">Finalizar</button>'
            : '') +
        '</td>';

      tbody.appendChild(tr);
    });
  }

  function renderAttendanceFilterOptions(sessions) {
    var select = $('#attendanceFilter');
    var current = select.value;

    select.innerHTML = '<option value="">Todas las sesiones</option>';

    sessions.forEach(function (session) {
      var option = document.createElement('option');
      option.value = session.code;
      option.textContent = session.subject + ' ' + session.grade +
        (session.section ? ' ' + session.section : '') + ' · ' + session.code;
      select.appendChild(option);
    });

    select.value = sessions.some(function (s) { return s.code === current; }) ? current : '';
  }

  function renderAttendanceTable(rows) {
    var tbody = $('#attendanceTable tbody');
    tbody.innerHTML = '';

    $('#attendanceEmpty').classList.toggle('hidden', rows.length > 0);
    $('#attendanceTable').classList.toggle('hidden', rows.length === 0);

    rows.slice(0, 150).forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(row.studentName) + '</td>' +
        '<td>' + esc(row.subject || '—') +
          '<br><small class="muted">' + esc(row.sessionCode) + '</small></td>' +
        '<td>' + esc(formatDateTime(row.timestamp)) + '</td>' +
        '<td><span class="badge badge-green">Presente</span></td>';
      tbody.appendChild(tr);
    });
  }

  function bindDocente() {
    $('#newSessionBtn').addEventListener('click', openSessionModal);
    $('#closeSessionModal').addEventListener('click', closeSessionModal);

    $('#sessionForm').addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!currentUser) return;

      var subject = $('#sessionSubject').value.trim();
      var grade = $('#sessionGrade').value.trim();
      var section = $('#sessionSection').value.trim();

      if (!subject || !grade) {
        toast('Complete la materia y el grado', 'error');
        return;
      }

      var button = event.target.querySelector('button[type="submit"]');

      try {
        setBusy(button, true, 'Generando…');
        var session = await JHP_DB.createSession({
          subject: subject,
          grade: grade,
          section: section,
          teacherId: currentUser.id,
          teacherName: currentUser.name
        });

        closeSessionModal();
        await renderDocente();
        openQrModal(session);
        toast('Sesión creada: ' + session.code, 'success');
      } catch (err) {
        console.error(err);
        toast('No se pudo crear la sesión', 'error');
      } finally {
        setBusy(button, false);
      }
    });

    $('#sessionsTable').addEventListener('click', async function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var qrBtn = target.closest('[data-qr]');
      var closeBtn = target.closest('[data-close]');

      if (qrBtn) {
        var code = qrBtn.getAttribute('data-qr');
        var session = sessionsCache.filter(function (s) { return s.code === code; })[0];
        if (session) openQrModal(session);
      }

      if (closeBtn) {
        var closeCode = closeBtn.getAttribute('data-close');
        if (!window.confirm('¿Finalizar esta sesión? Los estudiantes ya no podrán registrar asistencia en ella.')) return;

        try {
          await JHP_DB.closeSession(closeCode);
          await renderDocente();
          toast('Sesión finalizada', 'info');
        } catch (err) {
          console.error(err);
          toast('No se pudo finalizar la sesión', 'error');
        }
      }
    });

    $('#attendanceFilter').addEventListener('change', async function () {
      try {
        var rows = await JHP_DB.listAttendance(this.value || null);
        renderAttendanceTable(rows);
      } catch (err) {
        console.error(err);
        toast('No se pudieron filtrar las asistencias', 'error');
      }
    });

    $('#resetDemoBtn').addEventListener('click', function () {
      if (JHP_DB.isCloud()) return;
      if (!window.confirm('¿Restablecer los datos de demostración? Se borrarán las sesiones y asistencias guardadas en este navegador.')) return;

      JHP_DB.resetDemo();
      pendingCode = null;

      renderDocente();
      toast('Datos de demostración restablecidos', 'info');
    });
  }

  function openSessionModal() {
    $('#sessionForm').reset();
    $('#sessionModal').classList.remove('hidden');
    setTimeout(function () { $('#sessionSubject').focus(); }, 100);
  }

  function closeSessionModal() {
    $('#sessionModal').classList.add('hidden');
  }

  /* ================= Panel ESTUDIANTE ================= */

  async function renderEstudiante() {
    var rows = await JHP_DB.listStudentAttendance(currentUser);

    $('#estWelcome').textContent = 'Hola, ' + currentUser.name + '. Registre su asistencia con el código de su clase.';

    if (pendingCode) {
      var code = pendingCode;
      pendingCode = null;
      $('#sessionCodeInput').value = code;
      await showDetectedBanner(code);
    }

    var today = new Date().toDateString();
    var subjects = {};

    rows.forEach(function (row) {
      if (row.subject) subjects[row.subject] = true;
    });

    $('#estStatTotal').textContent = rows.length;
    $('#estStatSubjects').textContent = Object.keys(subjects).length;
    $('#estStatToday').textContent = rows.filter(function (row) {
      return new Date(row.timestamp).toDateString() === today;
    }).length;

    renderStudentHistory(rows);
  }

  function renderStudentHistory(rows) {
    var tbody = $('#studentHistoryTable tbody');
    tbody.innerHTML = '';

    $('#historyEmpty').classList.toggle('hidden', rows.length > 0);
    $('#studentHistoryTable').classList.toggle('hidden', rows.length === 0);

    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(row.subject || '—') + '</td>' +
        '<td>' + esc(row.grade || '') + ' ' + esc(row.section || '') + '</td>' +
        '<td>' + esc(formatDateTime(row.timestamp)) + '</td>' +
        '<td><span class="badge badge-green">Presente</span></td>';
      tbody.appendChild(tr);
    });
  }

  async function showDetectedBanner(code) {
    var banner = $('#detectedBanner');

    try {
      var session = await JHP_DB.getSession(code);

      if (session) {
        banner.innerHTML = '📷 QR detectado: <strong>' + esc(session.subject) + ' ' +
          esc(session.grade) + ' ' + esc(session.section || '') + '</strong> · ' + esc(session.code);
      } else {
        banner.innerHTML = '⚠️ Código detectado, pero la sesión no existe: <strong>' + esc(code) + '</strong>';
      }
    } catch (err) {
      banner.innerHTML = '⚠️ No se pudo verificar el código: <strong>' + esc(code) + '</strong>';
    }

    banner.classList.remove('hidden');
  }

  function bindEstudiante() {
    $('#registerForm').addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!currentUser) return;

      var code = $('#sessionCodeInput').value.trim().toUpperCase();
      var result = $('#registerResult');
      var button = event.target.querySelector('button[type="submit"]');

      try {
        setBusy(button, true, 'Registrando…');

        var response = await JHP_DB.registerAttendance({
          sessionCode: code,
          studentId: currentUser.id,
          studentName: currentUser.name
        });

        result.classList.remove('hidden');

        if (response.ok) {
          result.className = 'register-result success';
          result.innerHTML = '<strong>✓ Asistencia registrada</strong><br>' +
            esc(response.session.subject) + ' ' + esc(response.session.grade) + ' ' + esc(response.session.section || '') +
            '<br><small>' + esc(formatDateTime(response.timestamp)) + '</small>';

          toast('Asistencia registrada correctamente', 'success');
          $('#sessionCodeInput').value = '';
          $('#detectedBanner').classList.add('hidden');

          await renderEstudiante();
          result.classList.remove('hidden');
          return;
        }

        if (response.error === 'not_found') {
          result.className = 'register-result error';
          result.innerHTML = '<strong>Código no válido.</strong><br>Verifique el código con su docente.';
          toast('Código no válido', 'error');
          return;
        }

        if (response.error === 'closed') {
          result.className = 'register-result error';
          result.innerHTML = '<strong>Sesión finalizada.</strong><br>Esta clase ya no acepta registros de asistencia.';
          toast('La sesión está finalizada', 'error');
          return;
        }

        if (response.error === 'duplicate') {
          result.className = 'register-result warning';
          result.innerHTML = '<strong>Ya registró su asistencia.</strong><br>' +
            esc(response.session.subject) +
            (response.timestamp ? ' · ' + esc(formatDateTime(response.timestamp)) : '');
          toast('Ya registró asistencia en esta sesión', 'info');
          return;
        }

        result.className = 'register-result error';
        result.innerHTML = '<strong>No se pudo registrar.</strong><br>Intente nuevamente.';
        toast('No se pudo registrar la asistencia', 'error');
      } catch (err) {
        console.error(err);
        result.classList.remove('hidden');
        result.className = 'register-result error';
        result.innerHTML = '<strong>Error de conexión.</strong><br>No se pudo guardar el registro.';
        toast('Error de conexión con la base de datos', 'error');
      } finally {
        setBusy(button, false);
      }
    });
  }

  /* ================= QR ================= */

  function buildDeepLink(code) {
    var base = window.location.href.split('#')[0].split('?')[0];
    return base + '?code=' + encodeURIComponent(code);
  }

  function renderQR(container, text) {
    container.innerHTML = '';

    try {
      if (typeof window.qrcode === 'function') {
        var qr = window.qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        container.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4 });
        return;
      }
    } catch (err) {
      /* se usa el respaldo */
    }

    container.appendChild(fallbackQrCanvas(text));
  }

  function fallbackQrCanvas(text) {
    var canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 220;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 220, 220);

    function finder(x, y) {
      ctx.fillStyle = '#12294f';
      ctx.fillRect(x, y, 56, 56);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, y + 8, 40, 40);
      ctx.fillStyle = '#12294f';
      ctx.fillRect(x + 16, y + 16, 24, 24);
    }

    finder(12, 12);
    finder(152, 12);
    finder(12, 152);

    var hash = 0;
    for (var i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }

    ctx.fillStyle = '#12294f';
    for (var gy = 0; gy < 20; gy++) {
      for (var gx = 0; gx < 20; gx++) {
        var inFinder = (gx < 8 && gy < 8) || (gx > 11 && gy < 8) || (gx < 8 && gy > 11);
        if (inFinder) continue;

        hash = (hash * 1103515245 + 12345) >>> 0;
        if ((hash >>> 16) & 1) {
          ctx.fillRect(76 + gx * 7, 76 + gy * 7, 6, 6);
        }
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(64, 100, 92, 22);
    ctx.fillStyle = '#12294f';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text.slice(-14), 110, 115);

    return canvas;
  }

  function openQrModal(sessionOrCode) {
    var session = typeof sessionOrCode === 'string'
      ? sessionsCache.filter(function (s) { return s.code === sessionOrCode; })[0]
      : sessionOrCode;

    if (!session) {
      toast('Sesión no encontrada', 'error');
      return;
    }

    $('#qrTitle').textContent = 'QR · ' + session.subject + ' ' + session.grade +
      (session.section ? ' ' + session.section : '');
    $('#qrSubtitle').textContent = 'Código de sesión: ' + session.code;
    $('#qrCodeText').textContent = session.code;
    renderQR($('#qrContainer'), buildDeepLink(session.code));
    $('#qrModal').classList.remove('hidden');
  }

  function closeQrModal() {
    $('#qrModal').classList.add('hidden');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('Código copiado', 'success');
      }, function () {
        fallbackCopy(text);
      });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();

    try {
      document.execCommand('copy');
      toast('Código copiado', 'success');
    } catch (e) {
      toast('No se pudo copiar automáticamente', 'error');
    }

    document.body.removeChild(area);
  }

  function bindQr() {
    $('#closeQrModal').addEventListener('click', closeQrModal);

    $('#copyCodeBtn').addEventListener('click', function () {
      copyText($('#qrCodeText').textContent);
    });

    $$('.modal').forEach(function (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) modal.classList.add('hidden');
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSessionModal();
        closeQrModal();
      }
    });
  }

  /* ================= Enlace profundo (?code=...) ================= */

  function handleDeepLink() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');

    if (!code) return;

    pendingCode = code.trim().toUpperCase();

    if (!currentUser) {
      var studentCard = $('.role-card[data-role="estudiante"]');
      if (studentCard) studentCard.click();

      var hint = document.createElement('p');
      hint.className = 'hint highlight';
      hint.textContent = 'QR escaneado: ' + pendingCode + '. Ingrese su nombre para registrar su asistencia.';
      $('#loginForm').appendChild(hint);
    }
  }

  /* ================= Inicialización ================= */

  document.addEventListener('DOMContentLoaded', async function () {
    bindLogin();
    bindDocente();
    bindEstudiante();
    bindQr();

    applyMode();
    handleDeepLink();
    await route();
  });
})();

/* ============================================================
   Capa de datos — I.E. Javier Heraud Pérez
   ------------------------------------------------------------
   Funciona en dos modos:
   • DEMO:      guarda en localStorage (sin servidor).
   • SUPABASE:  usa autenticación y PostgreSQL en la nube.
   El modo se activa solo cuando config.js tiene credenciales.
   ============================================================ */

(function () {
  'use strict';

  var CFG = window.JHP_CONFIG || {};
  var DB_KEY = 'jhp_asistencia_db_v1';
  var SESSION_KEY = 'jhp_asistencia_session_v1';

  var cloudEnabled = !!(
    CFG.useSupabase &&
    CFG.supabaseUrl &&
    CFG.supabaseAnonKey &&
    window.supabase &&
    typeof window.supabase.createClient === 'function'
  );

  var client = cloudEnabled
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
    : null;

  /* ================= Utilidades ================= */

  function uid() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeCode(code) {
    return String(code == null ? '' : code).trim().toUpperCase();
  }

  function normName(name) {
    return String(name == null ? '' : name).trim().toLowerCase();
  }

  function generateCode(prefix) {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = (prefix || 'JHP') + '-';
    for (var i = 0; i < 6; i++) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return code;
  }

  /* ================= Modo local ================= */

  function loadLocal() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (!raw) return null;
      var db = JSON.parse(raw);
      if (!db || !Array.isArray(db.sessions) || !Array.isArray(db.attendance)) return null;
      return db;
    } catch (e) {
      return null;
    }
  }

  function saveLocal(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function seedDemo() {
    var now = Date.now();
    var s1 = {
      id: uid(),
      code: 'JHP-DEMO01',
      subject: 'Matemática',
      grade: '1°',
      section: 'A',
      teacher: 'Docente Demo',
      createdAt: new Date(now - 3600 * 1000).toISOString(),
      status: 'active'
    };
    var s2 = {
      id: uid(),
      code: 'JHP-DEMO02',
      subject: 'Comunicación',
      grade: '2°',
      section: 'B',
      teacher: 'Docente Demo',
      createdAt: new Date(now - 1800 * 1000).toISOString(),
      status: 'active'
    };

    return {
      sessions: [s1, s2],
      attendance: [
        { id: uid(), sessionCode: s1.code, studentName: 'Ana Torres', timestamp: new Date(now - 3000 * 1000).toISOString(), status: 'present' },
        { id: uid(), sessionCode: s1.code, studentName: 'Luis Ramírez', timestamp: new Date(now - 2900 * 1000).toISOString(), status: 'present' },
        { id: uid(), sessionCode: s1.code, studentName: 'Carla Mendoza', timestamp: new Date(now - 2800 * 1000).toISOString(), status: 'present' }
      ]
    };
  }

  function localDB() {
    var db = loadLocal();
    if (!db) {
      db = seedDemo();
      saveLocal(db);
    }
    return db;
  }

  function localSessionView(db, session) {
    return {
      id: session.id,
      code: session.code,
      subject: session.subject,
      grade: session.grade,
      section: session.section,
      teacher: session.teacher,
      status: session.status,
      createdAt: session.createdAt,
      attendanceCount: db.attendance.filter(function (a) {
        return a.sessionCode === session.code;
      }).length
    };
  }

  function localSessionByCode(code) {
    var db = localDB();
    var session = db.sessions.filter(function (s) {
      return s.code.toUpperCase() === normalizeCode(code);
    })[0];
    return session ? localSessionView(db, session) : null;
  }

  function localListSessions() {
    var db = localDB();
    return db.sessions
      .slice()
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
      .map(function (s) { return localSessionView(db, s); });
  }

  function localCreateSession(input) {
    var db = localDB();
    var code = generateCode();

    while (db.sessions.some(function (s) { return s.code === code; })) {
      code = generateCode();
    }

    var session = {
      id: uid(),
      code: code,
      subject: input.subject,
      grade: input.grade,
      section: input.section || '',
      teacher: input.teacherName || 'Docente',
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    db.sessions.push(session);
    saveLocal(db);
    return localSessionView(db, session);
  }

  function localCloseSession(code) {
    var db = localDB();
    db.sessions.forEach(function (s) {
      if (s.code === normalizeCode(code)) s.status = 'closed';
    });
    saveLocal(db);
  }

  function localAttendanceView(db, item) {
    var session = db.sessions.filter(function (s) { return s.code === item.sessionCode; })[0] || {};
    return {
      id: item.id,
      studentName: item.studentName,
      sessionCode: item.sessionCode,
      subject: session.subject || '',
      grade: session.grade || '',
      section: session.section || '',
      timestamp: item.timestamp,
      status: item.status
    };
  }

  function localListAttendance(code) {
    var db = localDB();
    var list = db.attendance.slice().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    if (code) {
      list = list.filter(function (a) {
        return a.sessionCode.toUpperCase() === normalizeCode(code);
      });
    }

    return list.map(function (a) { return localAttendanceView(db, a); });
  }

  function localRegisterAttendance(input) {
    var db = localDB();
    var session = db.sessions.filter(function (s) {
      return s.code.toUpperCase() === normalizeCode(input.sessionCode);
    })[0];

    if (!session) return { ok: false, error: 'not_found' };
    if (session.status !== 'active') return { ok: false, error: 'closed' };

    var duplicate = db.attendance.filter(function (a) {
      return a.sessionCode === session.code && normName(a.studentName) === normName(input.studentName);
    })[0];

    if (duplicate) {
      return {
        ok: false,
        error: 'duplicate',
        timestamp: duplicate.timestamp,
        session: localSessionView(db, session)
      };
    }

    var timestamp = new Date().toISOString();
    db.attendance.push({
      id: uid(),
      sessionCode: session.code,
      studentName: input.studentName,
      timestamp: timestamp,
      status: 'present'
    });
    saveLocal(db);

    return { ok: true, session: localSessionView(db, session), timestamp: timestamp };
  }

  function localStudentAttendance(name) {
    var db = localDB();
    return db.attendance
      .filter(function (a) { return normName(a.studentName) === normName(name); })
      .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); })
      .map(function (a) { return localAttendanceView(db, a); });
  }

  /* ================= Modo Supabase ================= */

  function mapClass(c) {
    return {
      id: c.id,
      code: c.qr_code,
      subject: c.name,
      grade: c.grade,
      section: c.section,
      teacherId: c.teacher_id,
      status: c.active ? 'active' : 'closed',
      createdAt: c.created_at,
      attendanceCount: Array.isArray(c.attendance) && c.attendance[0]
        ? Number(c.attendance[0].count)
        : 0
    };
  }

  function mapAttendance(a) {
    var session = a.classes || {};
    var student = a.student || a.profiles || {};
    return {
      id: a.id,
      studentName: student.full_name || '—',
      sessionCode: session.qr_code || '',
      subject: session.name || '',
      grade: session.grade || '',
      section: session.section || '',
      timestamp: a.attended_at,
      status: a.status
    };
  }

  async function cloudCurrentUser() {
    try {
      var res = await client.auth.getUser();
      if (res.error || !res.data || !res.data.user) return null;

      var user = res.data.user;
      var profileRes = await client
        .from('profiles')
        .select('full_name, role, email')
        .eq('id', user.id)
        .maybeSingle();

      var profile = profileRes.data || {};
      var meta = user.user_metadata || {};

      return {
        id: user.id,
        email: user.email,
        name: profile.full_name || meta.full_name || user.email,
        role: profile.role || meta.role || 'estudiante'
      };
    } catch (err) {
      return null;
    }
  }

  async function cloudAuthenticate(input) {
    var signIn = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password
    });

    if (!signIn.error) {
      return cloudCurrentUser();
    }

    var signUp = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.name,
          role: input.role
        }
      }
    });

    if (signUp.error) throw signUp.error;

    if (!signUp.data.session) {
      throw new Error('Cuenta creada. Confirme su correo o desactive la confirmación de email en Supabase.');
    }

    if (signUp.data.user) {
      await client.from('profiles').upsert({
        id: signUp.data.user.id,
        full_name: input.name,
        role: input.role,
        email: input.email
      });
    }

    return cloudCurrentUser();
  }

  async function cloudListSessions() {
    var res = await client
      .from('classes')
      .select('*, attendance(count)')
      .order('created_at', { ascending: false });

    if (res.error) throw res.error;
    return (res.data || []).map(mapClass);
  }

  async function cloudSessionByCode(code) {
    var res = await client
      .from('classes')
      .select('*, attendance(count)')
      .eq('qr_code', normalizeCode(code))
      .maybeSingle();

    if (res.error) throw res.error;
    return res.data ? mapClass(res.data) : null;
  }

  async function cloudCreateSession(input) {
    var code = generateCode();
    var res = await client
      .from('classes')
      .insert({
        name: input.subject,
        teacher_id: input.teacherId,
        grade: input.grade,
        section: input.section || null,
        qr_code: code,
        active: true
      })
      .select('*, attendance(count)')
      .single();

    if (res.error) throw res.error;
    return mapClass(res.data);
  }

  async function cloudCloseSession(code) {
    var res = await client
      .from('classes')
      .update({ active: false })
      .eq('qr_code', normalizeCode(code));

    if (res.error) throw res.error;
  }

  async function cloudListAttendance(code) {
    var select = 'id, attended_at, status, class_id, student:profiles(full_name), classes!inner(name, grade, section, qr_code)';
    var query = client
      .from('attendance')
      .select(select)
      .order('attended_at', { ascending: false })
      .limit(300);

    if (code) {
      query = query.eq('classes.qr_code', normalizeCode(code));
    }

    var res = await query;
    if (res.error) throw res.error;
    return (res.data || []).map(mapAttendance);
  }

  async function cloudRegisterAttendance(input) {
    var sessionRes = await client
      .from('classes')
      .select('*')
      .eq('qr_code', normalizeCode(input.sessionCode))
      .maybeSingle();

    if (sessionRes.error) throw sessionRes.error;

    var session = sessionRes.data;
    if (!session) return { ok: false, error: 'not_found' };
    if (!session.active) return { ok: false, error: 'closed' };

    var insert = await client
      .from('attendance')
      .insert({
        student_id: input.studentId,
        class_id: session.id,
        status: 'present'
      })
      .select('attended_at')
      .single();

    if (insert.error) {
      if (insert.error.code === '23505') {
        var previous = await client
          .from('attendance')
          .select('attended_at')
          .eq('student_id', input.studentId)
          .eq('class_id', session.id)
          .maybeSingle();

        return {
          ok: false,
          error: 'duplicate',
          timestamp: previous.data ? previous.data.attended_at : null,
          session: mapClass(session)
        };
      }
      throw insert.error;
    }

    return {
      ok: true,
      session: mapClass(session),
      timestamp: insert.data.attended_at
    };
  }

  async function cloudStudentAttendance(user) {
    var res = await client
      .from('attendance')
      .select('id, attended_at, status, classes!inner(name, grade, section, qr_code)')
      .eq('student_id', user.id)
      .order('attended_at', { ascending: false });

    if (res.error) throw res.error;
    return (res.data || []).map(mapAttendance);
  }

  /* ================= API pública ================= */

  window.JHP_DB = {
    isCloud: function () { return cloudEnabled; },

    currentUser: async function () {
      if (!cloudEnabled) {
        try {
          var raw = sessionStorage.getItem(SESSION_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          return null;
        }
      }
      return cloudCurrentUser();
    },

    authenticate: async function (input) {
      if (!cloudEnabled) {
        var user = {
          id: 'local-' + normName(input.name).replace(/\s+/g, '-'),
          name: input.name,
          role: input.role,
          email: ''
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
      }
      return cloudAuthenticate(input);
    },

    signOut: async function () {
      sessionStorage.removeItem(SESSION_KEY);
      if (cloudEnabled) {
        try { await client.auth.signOut(); } catch (e) { /* ignorar */ }
      }
    },

    listSessions: async function () {
      return cloudEnabled ? cloudListSessions() : localListSessions();
    },

    getSession: async function (code) {
      return cloudEnabled ? cloudSessionByCode(code) : localSessionByCode(code);
    },

    createSession: async function (input) {
      return cloudEnabled ? cloudCreateSession(input) : localCreateSession(input);
    },

    closeSession: async function (code) {
      return cloudEnabled ? cloudCloseSession(code) : localCloseSession(code);
    },

    listAttendance: async function (code) {
      return cloudEnabled ? cloudListAttendance(code) : localListAttendance(code);
    },

    registerAttendance: async function (input) {
      return cloudEnabled ? cloudRegisterAttendance(input) : localRegisterAttendance(input);
    },

    listStudentAttendance: async function (user) {
      return cloudEnabled ? cloudStudentAttendance(user) : localStudentAttendance(user.name);
    },

    resetDemo: function () {
      if (!cloudEnabled) localStorage.removeItem(DB_KEY);
    }
  };
})();

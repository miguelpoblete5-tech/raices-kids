import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Calendar, Users, Shield, UserCheck, Plus, CheckCircle, Lock, LogOut } from 'lucide-react';

export default function App() {
  const [tab, setTab] = useState('anotacion');
  
  // Estados del formulario de anotación
  const [nombre, setNombre] = useState('');
  const [paso, setPaso] = useState(1);
  const [fecha, setFecha] = useState('');
  const [rol, setRol] = useState('');
  const [anotaciones, setAnotaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState(false);

  // Estados de autenticación para Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [cargandoLogin, setCargandoLogin] = useState(false);

  useEffect(() => {
    fetchAnotaciones();
    checkUserSession();
  }, []);

  async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsAdmin(true);
    }
  }

  async function fetchAnotaciones() {
    const { data, error } = await supabase
      .from('anotaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnotaciones(data);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre || !fecha || !rol) return;

    setCargando(true);
    setErrorMensaje(false);
    const { error } = await supabase
      .from('anotaciones')
      .insert([{ nombre, fecha, rol, estado: 'pendiente' }]);

    if (!error) {
      fetchAnotaciones();
      setPaso(3);
    } else {
      setErrorMensaje(true);
    }
    setCargando(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setCargandoLogin(true);
    setErrorLogin('');

    const { error } = await supabase.auth.signInWithPassword({
      email: emailAdmin,
      password: passwordAdmin,
    });

    if (error) {
      setErrorLogin('Credenciales inválidas. Por favor intenta de nuevo.');
    } else {
      setIsAdmin(true);
      setEmailAdmin('');
      setPasswordAdmin('');
    }
    setCargandoLogin(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F4EB] text-stone-800 p-4 sm:p-6 font-sans">
      <header className="max-w-2xl mx-auto text-center mb-8 pt-4">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="bg-[#2D4030] text-white p-3 rounded-2xl shadow-sm">
            <span className="text-2xl font-bold">🌱</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#2D4030]">Raíces Kids</h1>
        </div>
        <p className="text-stone-600 text-sm">Equipo de servicio · escuela bíblica infantil</p>
      </header>

      <nav className="max-w-2xl mx-auto flex justify-around border-b border-stone-300 mb-6">
        {[
          { id: 'anotacion', label: 'Mi anotación', icon: UserCheck },
          { id: 'calendario', label: 'Calendario', icon: Calendar },
          { id: 'padres', label: 'Padres', icon: Users },
          { id: 'admin', label: 'Administración', icon: Shield },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`pb-3 px-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
              tab === item.id
                ? 'border-b-2 border-[#8C4A32] text-[#8C4A32]'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <main className="max-w-2xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
        {/* PESTAÑA 1: MI ANOTACIÓN */}
        {tab === 'anotacion' && (
          <div>
            {paso === 1 && (
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-stone-700">Tu nombre</label>
                <input
                  type="text"
                  placeholder="Escribí tu nombre y apellido"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#8C4A32]"
                />
                <button
                  onClick={() => nombre && setPaso(2)}
                  className="w-full bg-[#2D4030] text-white p-3 rounded-xl font-medium hover:bg-[#233226] transition-colors"
                >
                  Continuar &rarr;
                </button>
              </div>
            )}

            {paso === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-bold text-stone-800">Hola, {nombre}</h2>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Fecha de servicio</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#8C4A32]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Rol / Función</label>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    className="w-full p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#8C4A32]"
                  >
                    <option value="">Selecciona un rol</option>
                    <option value="Maestro/a">Maestro/a</option>
                    <option value="Auxiliar">Auxiliar</option>
                    <option value="Bienvenida">Bienvenida</option>
                  </select>
                </div>

                {errorMensaje && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                    No pudimos guardar tu anotación en la base de datos. Verifica tu conexión.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full bg-[#8C4A32] text-white p-3 rounded-xl font-medium hover:bg-[#733c28] transition-colors flex justify-center items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {cargando ? 'Guardando...' : 'Confirmar Anotación'}
                </button>
              </form>
            )}

            {paso === 3 && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                <h2 className="text-xl font-bold text-stone-800">¡Anotación Guardada!</h2>
                <p className="text-stone-600 text-sm">Tu registro se sincronizó exitosamente en la base de datos.</p>
                <button
                  onClick={() => { setPaso(1); setFecha(''); setRol(''); }}
                  className="mt-4 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200"
                >
                  Registrar otra fecha
                </button>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: CALENDARIO */}
        {tab === 'calendario' && (
          <div className="text-center py-8 text-stone-500 space-y-2">
            <Calendar className="w-12 h-12 mx-auto text-[#2D4030] opacity-80" />
            <h3 className="font-semibold text-stone-800 text-lg">Próximas Fechas de Servicio</h3>
            <p className="text-sm">Aquí se listarán las clases y cronogramas programados.</p>
          </div>
        )}

        {/* PESTAÑA 3: PADRES */}
        {tab === 'padres' && (
          <div className="text-center py-8 text-stone-500 space-y-2">
            <Users className="w-12 h-12 mx-auto text-[#2D4030] opacity-80" />
            <h3 className="font-semibold text-stone-800 text-lg">Portal de Familias</h3>
            <p className="text-sm">Módulo informativo y fichas de niños.</p>
          </div>
        )}

        {/* PESTAÑA 4: ADMINISTRACIÓN */}
        {tab === 'admin' && (
          <div>
            {!isAdmin ? (
              /* Formularios de Login cuando NO se está autenticado */
              <form onSubmit={handleLogin} className="space-y-4 max-w-sm mx-auto py-4">
                <div className="text-center mb-6">
                  <Lock className="w-10 h-10 text-[#8C4A32] mx-auto mb-2" />
                  <h2 className="text-xl font-bold text-stone-800">Acceso Administrativo</h2>
                  <p className="text-xs text-stone-500">Ingresa con tus credenciales de Supabase</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@raiceskids.org"
                    value={emailAdmin}
                    onChange={(e) => setEmailAdmin(e.target.value)}
                    className="w-full p-3 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C4A32]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={passwordAdmin}
                    onChange={(e) => setPasswordAdmin(e.target.value)}
                    className="w-full p-3 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C4A32]"
                  />
                </div>

                {errorLogin && (
                  <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 text-center">
                    {errorLogin}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={cargandoLogin}
                  className="w-full bg-[#2D4030] text-white p-3 rounded-xl text-sm font-medium hover:bg-[#233226] transition-colors"
                >
                  {cargandoLogin ? 'Verificando...' : 'Iniciar Sesión'}
                </button>
              </form>
            ) : (
              /* Vista del panel administrativo cuando SÍ se inició sesión */
              <div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-stone-200">
                  <div>
                    <h2 className="text-lg font-bold text-stone-800">Panel de Administración</h2>
                    <p className="text-xs text-stone-500">Registro total de voluntariado</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Cerrar Sesión
                  </button>
                </div>

                {anotaciones.length === 0 ? (
                  <p className="text-stone-500 text-sm text-center py-6">No hay registros almacenados todavía.</p>
                ) : (
                  <div className="space-y-3">
                    {anotaciones.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-xl border border-stone-200 flex justify-between items-center bg-stone-50">
                        <div>
                          <p className="font-semibold text-stone-800 text-sm">{item.nombre}</p>
                          <p className="text-xs text-stone-500">{item.fecha} · {item.rol}</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium capitalize">
                          {item.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
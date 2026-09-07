import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Calendar, Users, Shield, UserCheck, Plus, CheckCircle } from 'lucide-react';

export default function App() {
  const [tab, setTab] = useState('anotacion');
  const [nombre, setNombre] = useState('');
  const [paso, setPaso] = useState(1);
  const [fecha, setFecha] = useState('');
  const [rol, setRol] = useState('');
  const [anotaciones, setAnotaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState(false);

  useEffect(() => {
    fetchAnotaciones();
  }, []);

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

        {tab === 'admin' && (
          <div>
            <h2 className="text-lg font-bold text-stone-800 mb-4">Anotaciones registradas</h2>
            {anotaciones.length === 0 ? (
              <p className="text-stone-500 text-sm">No hay registros aún.</p>
            ) : (
              <div className="space-y-3">
                {anotaciones.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-stone-200 flex justify-between items-center bg-stone-50">
                    <div>
                      <p className="font-semibold text-stone-800">{item.nombre}</p>
                      <p className="text-xs text-stone-500">{item.fecha} · {item.rol}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-medium">
                      {item.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
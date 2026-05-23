import { useState, useEffect } from 'react';
import { processarEstatisticas, salvarSessaoEstudos } from './estatisticas.js';
import { ResponsiveContainer, LineChart, Line, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export default function Estatisticas({ userId }) {
    const [dados, setDados] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ tipo: '', texto: '' });
    
    // Pegar data de hoje no formato YYYY-MM-DD para o input padrão
    const dataHoje = new Date().toISOString().split('T')[0];

    // Estados do formulário de inserção
    const [materia, setMateria] = useState('');
    const [acertos, setAcertos] = useState('');
    const [erros, setErros] = useState('');
    const [dataEstudo, setDataEstudo] = useState(dataHoje);

    const CORES = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b'];

    const carregarDados = () => {
        processarEstatisticas(userId).then(setDados);
    };

    useEffect(() => {
        carregarDados();
    }, [userId]);

    const handleSalvarRegistro = async (e) => {
        e.preventDefault();
        
        const numAcertos = parseInt(acertos) || 0;
        const numErros = parseInt(erros) || 0;

        if (numAcertos === 0 && numErros === 0) {
            setStatusMsg({ tipo: 'erro', texto: 'Informe pelo menos um acerto ou erro.' });
            setTimeout(() => setStatusMsg({ tipo: '', texto: '' }), 3000);
            return;
        }

        setIsSaving(true);
        setStatusMsg({ tipo: '', texto: '' });

        const { error } = await salvarSessaoEstudos(userId, numAcertos, numErros, materia, dataEstudo);

        if (!error) {
            setMateria('');
            setAcertos('');
            setErros('');
            setDataEstudo(dataHoje); // Reseta para hoje
            setStatusMsg({ tipo: 'sucesso', texto: 'Sessão registrada com sucesso!' });
            carregarDados(); 
        } else {
            setStatusMsg({ tipo: 'erro', texto: 'Falha ao salvar no banco.' });
        }

        setIsSaving(false);
        // Limpa a mensagem após 4 segundos
        setTimeout(() => setStatusMsg({ tipo: '', texto: '' }), 4000);
    };

    if (!dados) return <div className="text-slate-500 text-center animate-pulse mt-10">Processando métricas...</div>;

    const totalCalculado = (parseInt(acertos) || 0) + (parseInt(erros) || 0);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto p-8 rounded-[2rem] bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl"
        >
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Performance Geral</h2>
                    <p className="text-slate-400">Total respondido: <span className="text-emerald-400 font-bold">{dados.geral.totalQuestoes}</span> questões</p>
                </div>
                <div className="text-right">
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                        {dados.geral.taxaAcerto}%
                    </span>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Taxa de Acerto</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Gráfico de Evolução */}
                <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                    <h3 className="text-slate-400 mb-4 font-semibold">Evolução Temporal (%)</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dados.evolucao}>
                                <Line type="monotone" dataKey="performance" stroke="#6366f1" strokeWidth={4} dot={{r: 4}} activeDot={{r: 6}} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff'}} 
                                    itemStyle={{color: '#34d399'}}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Matérias */}
                <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                    <h3 className="text-slate-400 mb-4 font-semibold">Distribuição</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            {/* O segredo está neste key: ele força o Recharts a atualizar o gráfico sempre que os valores mudarem */}
                            <PieChart key={JSON.stringify(dados.pizza)}>
                                <Pie 
                                    data={dados.pizza} 
                                    dataKey="value" 
                                    nameKey="name"
                                    innerRadius={50} 
                                    outerRadius={70} 
                                    cornerRadius={10} 
                                    paddingAngle={5}
                                >
                                    {dados.pizza.map((entry, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Formulário de Registro */}
            <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-slate-400 font-semibold">Registrar Sessão</h3>
                    {totalCalculado > 0 && (
                        <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
                            Total: {totalCalculado} questões
                        </span>
                    )}
                </div>

                <form onSubmit={handleSalvarRegistro} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <input 
                            type="date" 
                            value={dataEstudo}
                            onChange={(e) => setDataEstudo(e.target.value)}
                            required
                            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        />
                        
                        <input 
                            type="text" 
                            placeholder="Matéria (ex: Cálculo, Programação)" 
                            value={materia}
                            onChange={(e) => setMateria(e.target.value)}
                            required
                            list="materias-sugestoes"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
                        />
                        
                        <datalist id="materias-sugestoes">
                            <option value="Cálculo" />
                            <option value="Programação" />
                            <option value="Física" />
                            <option value="Matemática" />
                        </datalist>

                        <input 
                            type="number" 
                            placeholder="Acertos" 
                            value={acertos}
                            onChange={(e) => setAcertos(e.target.value)}
                            min="0"
                            className="w-full md:w-28 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
                        />
                        <input 
                            type="number" 
                            placeholder="Erros" 
                            value={erros}
                            onChange={(e) => setErros(e.target.value)}
                            min="0"
                            className="w-full md:w-28 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
                        />
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        {/* Área de mensagens de feedback */}
                        <div className="flex-1">
                            <AnimatePresence>
                                {statusMsg.texto && (
                                    <motion.span 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`text-sm font-medium ${statusMsg.tipo === 'sucesso' ? 'text-emerald-400' : 'text-rose-400'}`}
                                    >
                                        {statusMsg.texto}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        <button 
                            type="submit"
                            disabled={isSaving}
                            className={`bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-500/20 ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            {isSaving ? 'Registrando...' : 'Salvar Sessão'}
                        </button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
}
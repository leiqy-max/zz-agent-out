import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './Login';
import KnowledgeDocs from './KnowledgeDocs';
import { 
  Send, User, Bot, Image as ImageIcon, Paperclip, 
  Globe, Sparkles, X, MoreHorizontal, Code, UploadCloud, FileText,
  Scissors, Check, RotateCcw, RefreshCw, ThumbsUp, ThumbsDown, LogOut, Shield, ShieldCheck, Download, Target, Menu, Database, Trash2,
  BarChart2, MessageSquare, Calendar, HelpCircle, BookOpen, Award
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 工具函数：合并类名
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Global axios interceptor
axios.interceptors.request.use(
  (config) => {
    const auth = JSON.parse(localStorage.getItem('auth'));
    if (auth?.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 裁剪模态框组件
function CropModal({ imageSrc, onConfirm, onCancel }) {
  const [selection, setSelection] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const getClientPos = (e) => {
    const { left, top } = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - left,
      y: e.clientY - top
    };
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    const pos = getClientPos(e);
    setIsDragging(true);
    setStartPos(pos);
    setSelection({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const pos = getClientPos(e);
    
    const x = Math.min(pos.x, startPos.x);
    const y = Math.min(pos.y, startPos.y);
    const width = Math.abs(pos.x - startPos.x);
    const height = Math.abs(pos.y - startPos.y);

    setSelection({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirm = () => {
    if (!selection || selection.width === 0 || selection.height === 0) {
      // 如果没有选区，默认确认整张图
      onConfirm(imageSrc);
      return;
    }

    const canvas = document.createElement('canvas');
    const img = imgRef.current;
    
    // 计算缩放比例
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    canvas.width = selection.width * scaleX;
    canvas.height = selection.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      selection.x * scaleX,
      selection.y * scaleY,
      selection.width * scaleX,
      selection.height * scaleY,
      0, 0,
      canvas.width,
      canvas.height
    );

    onConfirm(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center select-none animate-in fade-in duration-200">
      <div className="relative mb-4">
        <div 
          ref={containerRef}
          className="relative cursor-crosshair overflow-hidden border border-gray-700 shadow-2xl"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img 
            ref={imgRef} 
            src={imageSrc} 
            alt="Original" 
            className="max-h-[80vh] max-w-[90vw] object-contain block select-none pointer-events-none"
            draggable={false}
          />
          {selection && (
            <div 
              style={{ 
                left: selection.x, 
                top: selection.y, 
                width: selection.width, 
                height: selection.height,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' 
              }} 
              className="absolute border-2 border-blue-500 z-10"
            >
              {/* 尺寸提示 */}
              <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-1 rounded">
                {Math.round(selection.width)} x {Math.round(selection.height)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex space-x-4">
        <button 
          onClick={onCancel}
          className="flex items-center px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
        >
          <X size={18} className="mr-2" /> 取消
        </button>
        <button 
          onClick={() => setSelection(null)}
          className="flex items-center px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
        >
          <RotateCcw size={18} className="mr-2" /> 重选
        </button>
        <button 
          onClick={handleConfirm}
          className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors font-medium shadow-lg shadow-blue-900/50"
        >
          <Check size={18} className="mr-2" /> 
          {(!selection || selection.width === 0) ? '发送全屏' : '确认裁剪'}
        </button>
      </div>
      
      <div className="mt-4 text-gray-400 text-sm">
        拖拽框选区域，或直接点击确认发送全屏
      </div>
    </div>
  );
}

// 数据看板组件
function DashboardView({ userRole }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('today_questions'); // Default tab

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/dashboard/stats');
            console.log("Fetched stats:", res.data);
            setStats(res.data);
            // Set default tab based on role if needed, but today_questions works for both (mapped correctly)
            if (userRole !== 'admin') {
                setActiveTab('my_questions');
            }
        } catch (e) {
            console.error("Error fetching stats:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center text-gray-500">加载中...</div>;
    if (!stats) return <div className="h-full flex items-center justify-center text-red-500">加载失败</div>;

    return (
        <div className="h-full bg-gray-50 p-6 flex flex-col overflow-hidden">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 flex-shrink-0">数据看板</h1>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 flex-shrink-0">
                {userRole === 'admin' ? (
                    <>
                        <StatCard 
                            title="今日提问" 
                            value={stats.today_questions} 
                            icon={MessageSquare} 
                            color="blue" 
                            isActive={activeTab === 'today_questions'}
                            onClick={() => setActiveTab('today_questions')}
                        />
                        <StatCard 
                            title="本月提问" 
                            value={stats.month_questions} 
                            icon={Calendar} 
                            color="indigo" 
                            isActive={activeTab === 'month_questions'}
                            onClick={() => setActiveTab('month_questions')}
                        />
                        <StatCard 
                            title="待解问题" 
                            value={stats.pending_questions} 
                            icon={HelpCircle} 
                            color="orange" 
                            isActive={activeTab === 'pending_questions'}
                            onClick={() => setActiveTab('pending_questions')}
                        />
                        <StatCard 
                            title="本月习得知识" 
                            value={stats.month_learned} 
                            icon={BookOpen} 
                            color="green" 
                            isActive={activeTab === 'month_learned'}
                            onClick={() => setActiveTab('month_learned')}
                        />
                    </>
                ) : (
                    <>
                        <StatCard 
                            title="我的提问" 
                            value={stats.my_questions} 
                            icon={MessageSquare} 
                            color="blue" 
                            isActive={activeTab === 'my_questions'}
                            onClick={() => setActiveTab('my_questions')}
                        />
                        <StatCard 
                            title="我的贡献" 
                            value={stats.my_contributions} 
                            icon={Award} 
                            color="purple" 
                            isActive={activeTab === 'my_contributions'}
                            onClick={() => setActiveTab('my_contributions')}
                        />
                    </>
                )}
            </div>

            {/* Detail View */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50 font-medium text-gray-700 flex items-center">
                    {activeTab === 'today_questions' && <><MessageSquare size={18} className="mr-2"/> 今日提问详情</>}
                    {activeTab === 'month_questions' && <><Calendar size={18} className="mr-2"/> 本月提问详情</>}
                    {activeTab === 'pending_questions' && <><HelpCircle size={18} className="mr-2"/> 待解问题详情</>}
                    {activeTab === 'month_learned' && <><BookOpen size={18} className="mr-2"/> 本月习得知识详情</>}
                    {activeTab === 'my_questions' && <><MessageSquare size={18} className="mr-2"/> 我的提问记录</>}
                    {activeTab === 'my_contributions' && <><Award size={18} className="mr-2"/> 我的贡献记录</>}
                </div>
                <div className="flex-1 overflow-hidden relative">
                    {/* Render different views based on activeTab */}
                    {(activeTab === 'today_questions' || activeTab === 'month_questions' || activeTab === 'my_questions') && (
                        <DashboardLogsTable 
                            filterDate={activeTab === 'today_questions' ? 'today' : (activeTab === 'month_questions' ? 'month' : null)} 
                            scope={activeTab === 'my_questions' ? 'me' : 'all'}
                        />
                    )}
                    {activeTab === 'pending_questions' && (
                        <UnknownQuestionsView userRole={userRole} embed={true} />
                    )}
                    {(activeTab === 'month_learned' || activeTab === 'my_contributions') && (
                        <LearningRecordsView 
                            userRole={userRole} 
                            embed={true} 
                            filterScope={activeTab === 'my_contributions' ? 'me' : 'all'}
                            filterDate={activeTab === 'month_learned' ? 'month' : null}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, isActive, onClick }) {
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600 border-blue-200",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
        orange: "bg-orange-50 text-orange-600 border-orange-200",
        green: "bg-green-50 text-green-600 border-green-200",
        purple: "bg-purple-50 text-purple-600 border-purple-200",
    };

    return (
        <div 
            onClick={onClick}
            className={cn(
                "bg-white p-6 rounded-xl shadow-sm border flex items-center space-x-4 cursor-pointer transition-all",
                isActive ? "ring-2 ring-blue-500 border-transparent shadow-md transform scale-[1.02]" : "border-gray-100 hover:shadow-md hover:border-blue-200"
            )}
        >
            <div className={`p-4 rounded-full ${colorClasses[color] || colorClasses.blue}`}>
                <Icon size={24} />
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    <p className="text-xl font-bold text-gray-800">{value !== undefined && value !== null ? value : '-'}</p>
                </div>
            </div>
        </div>
    );
}

// Reusable Logs Table for Dashboard
function DashboardLogsTable({ filterDate, scope }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        fetchLogs();
    }, [page, filterDate, scope]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let url = `/admin/chat_logs?page=${page}&limit=${limit}&scope=${scope}`;
            if (filterDate) {
                url += `&filter_date=${filterDate}`;
            }
            const res = await axios.get(url);
            setLogs(res.data.logs || []);
            setTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 text-gray-500 text-sm">
                            <th className="p-3 font-medium">提问时间</th>
                            <th className="p-3 font-medium">用户</th>
                            <th className="p-3 font-medium">问题</th>
                            <th className="p-3 font-medium">回答预览</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">加载中...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">暂无数据</td></tr>
                        ) : (
                            logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors text-sm">
                                    <td className="p-3 text-gray-500 w-40">{log.created_at}</td>
                                    <td className="p-3 font-medium text-gray-700 w-32 truncate">{log.username}</td>
                                    <td className="p-3 text-gray-800 max-w-xs truncate" title={log.question}>{log.question}</td>
                                    <td className="p-3 text-gray-600 max-w-sm truncate" title={log.answer}>{log.answer}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
             {/* Pagination */}
             {total > limit && (
                <div className="p-4 border-t border-gray-200 flex justify-center space-x-2 bg-white">
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 text-sm"
                    >
                        上一页
                    </button>
                    <span className="px-3 py-1 text-gray-600 text-sm">
                        {page} / {Math.ceil(total / limit)}
                    </span>
                    <button 
                        disabled={page * limit >= total}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 text-sm"
                    >
                        下一页
                    </button>
                </div>
            )}
        </div>
    );
}

// 侧边栏组件
function Sidebar({ activeView, onViewChange, userRole, username, onLogout, onUpload }) {
  const menuGroups = [
    {
      title: '智能助手',
      items: [
        { id: 'chat', label: '智能问答', icon: Bot },
        { id: 'knowledge', label: '文档资源', icon: FileText },
      ]
    },
    {
      title: '知识共建',
      items: [
        { id: 'unknown', label: '待解问题', icon: Sparkles },
        { id: 'training', label: '知识录入', icon: Target },
      ]
    },
    ...(userRole !== 'admin' ? [{
      title: '运行简报',
      items: [
        { id: 'learning', label: '进化历程', icon: Database },
        { id: 'dashboard', label: '数据看板', icon: BarChart2 },
      ]
    }] : []),
    {
      title: '运维管理',
      adminOnly: true,
      items: [
        { id: 'approval', label: '审批中心', icon: ShieldCheck },
        { id: 'global_logs', label: '全局日志', icon: Globe },
        { id: 'dashboard', label: '数据看板', icon: BarChart2 },
        { id: 'learning', label: '进化历程', icon: Database },
      ]
    }
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg md:shadow-none">
      <div className="p-4 border-b border-gray-200 flex items-center space-x-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
          综资
        </div>
        <span className="font-bold text-gray-800 text-lg">Ops Agent</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {menuGroups.map((group, index) => {
          if (group.adminOnly && userRole !== 'admin') return null;
          
          return (
            <div key={index}>
              <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                [{group.title}]
              </div>
              <div className="space-y-1">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={cn(
                      "w-full flex items-center space-x-3 px-4 py-2 text-sm font-medium transition-colors",
                      activeView === item.id 
                        ? "bg-blue-50 text-blue-600 border-r-4 border-blue-600" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-200 space-y-4">
        {(userRole === 'admin' || userRole === 'user') && (
          <button
             onClick={onUpload}
             className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
          >
             <UploadCloud size={16} />
             <span>上传知识库</span>
          </button>
        )}

        <div className="bg-gray-50 rounded-lg p-3">
             <div className="flex items-center justify-between mb-2">
                 <span className="font-bold text-gray-700 truncate max-w-[120px]" title={username}>{username}</span>
                 {userRole === 'admin' && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">管理员</span>
                 )}
             </div>
             <button
              onClick={onLogout}
              className="w-full flex items-center space-x-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              <LogOut size={16} />
              <span>退出登录</span>
            </button>
        </div>
      </div>
    </div>
  );
}

// 训练模式组件
function TrainingMode() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [prePolishAnswer, setPrePolishAnswer] = useState("");

  const handleSubmit = async () => {
    if (!question.trim() || !answer.trim()) {
      alert("请填写完整的问题和答案");
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/admin/add_qa', { question, answer });
      alert(res.data.message || "操作成功！");
      setQuestion("");
      setAnswer("");
      setPrePolishAnswer("");
    } catch (e) {
      alert("操作失败: " + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePolish = async () => {
    if (!question.trim() || !answer.trim()) {
      alert("请先填写问题和草稿答案，AI才能帮您润色");
      return;
    }
    setPrePolishAnswer(answer); // Save current answer before polishing
    setPolishing(true);
    try {
      const res = await axios.post('/admin/polish_answer', { 
        question, 
        draft_answer: answer 
      });
      if (res.data.status === 'success') {
        setAnswer(res.data.polished_answer);
      }
    } catch (e) {
      alert("润色失败: " + (e.response?.data?.detail || e.message));
    } finally {
      setPolishing(false);
    }
  };

  const handleKeyDown = (e) => {
    // Ctrl+Z to undo polish
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (prePolishAnswer) {
        e.preventDefault();
        setAnswer(prePolishAnswer);
        setPrePolishAnswer(""); // Clear after undo
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Target className="mr-3 text-blue-600" />
          问答补全
        </h2>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm mb-6">
            在此模式下，您可以手动录入标准问答对。
            系统将直接学习这些内容，当用户提出相同或相似问题时，直接返回您设定的答案。
            <br/>
            <span className="text-xs opacity-75 mt-1 block">
              * 管理员提交直接生效，普通用户提交需管理员审批。
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              预期问题 (Question)
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="例如：如何重置路由器密码？"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                标准答案 (Answer)
              </label>
              <div className="flex items-center space-x-2">
                {prePolishAnswer && (
                    <span className="text-xs text-gray-400 mr-2">按 Ctrl+Z 撤销润色</span>
                )}
                <button
                    onClick={handlePolish}
                    disabled={polishing || !question.trim() || !answer.trim()}
                    className="flex items-center text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-full transition-colors disabled:opacity-50"
                >
                    <Sparkles size={14} className={cn("mr-1", polishing ? "animate-spin" : "")} />
                    {polishing ? "AI 正在润色..." : "AI 润色优化"}
                </button>
              </div>
            </div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="输入标准的回答内容..."
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? (
                <>
                  <RefreshCw className="animate-spin mr-2" size={18} />
                  提交中...
                </>
              ) : (
                <>
                  <Check className="mr-2" size={18} />
                  提交并学习
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 图片放大模态框组件
function ImageZoomModal({ imageSrc, onClose }) {
  if (!imageSrc) return null;

  return (
    <div 
      className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center animate-in fade-in duration-200 cursor-zoom-out"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-50"
      >
        <X size={24} />
      </button>
      <img 
        src={imageSrc} 
        alt="Zoomed" 
        className="max-h-screen max-w-screen object-contain p-4"
        onClick={(e) => e.stopPropagation()} // 防止点击图片关闭
      />
    </div>
  );
}

// 管理员审批视图
function AdminView() {
    const [activeTab, setActiveTab] = useState('docs'); // 'docs' or 'qa'
    const [docs, setDocs] = useState([]);
    const [qaItems, setQaItems] = useState([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (activeTab === 'docs') {
            fetchDocs();
        } else {
            fetchQA();
        }
    }, [activeTab]);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/pending_docs');
            setDocs(res.data.docs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchQA = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/pending_qa');
            setQaItems(res.data.items || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            await axios.post(`/approve_doc/${id}`);
            fetchDocs(); // refresh
        } catch (e) {
            alert("操作失败: " + e.message);
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("确定要拒绝该文档吗？")) return;
        try {
            await axios.post(`/reject_doc/${id}`);
            fetchDocs(); // refresh
        } catch (e) {
            alert("操作失败: " + e.message);
        }
    };

    const handleApproveQA = async (id) => {
        try {
            await axios.post(`/admin/approve_qa/${id}`);
            fetchQA(); // refresh
        } catch (e) {
            alert("操作失败: " + e.message);
        }
    };

    const handleRejectQA = async (id) => {
        if (!window.confirm("确定要拒绝该问答吗？")) return;
        try {
            await axios.post(`/admin/reject_qa/${id}`);
            fetchQA(); // refresh
        } catch (e) {
            alert("操作失败: " + e.message);
        }
    };

    const handleDownload = async (id, filename) => {
        try {
            const response = await axios.get(`/download_doc/${id}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert("下载失败: " + (e.response?.data?.detail || e.message));
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
            <div className="max-w-6xl mx-auto w-full h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-xl font-bold flex items-center text-gray-800 mr-4">
                            <ShieldCheck className="mr-2 text-blue-600" />
                            审批中心
                        </h2>
                        
                        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('docs')}
                                className={cn(
                                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                                    activeTab === 'docs' 
                                        ? "bg-white text-blue-600 shadow-sm" 
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                文档审批
                            </button>
                            <button
                                onClick={() => setActiveTab('qa')}
                                className={cn(
                                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                                    activeTab === 'qa' 
                                        ? "bg-white text-blue-600 shadow-sm" 
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                问答审批
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={activeTab === 'docs' ? fetchDocs : fetchQA} 
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors" 
                        title="刷新"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'docs' ? (
                        // Docs List
                        loading ? (
                            <div className="text-center py-8 text-gray-500">加载中...</div>
                        ) : docs.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">暂无待审批文档</div>
                        ) : (
                            <div className="space-y-3">
                                {docs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-800">{doc.filename}</span>
                                            <div className="text-xs text-gray-500 flex space-x-2 mt-1">
                                                <span>上传者: {doc.uploader}</span>
                                                <span>时间: {doc.created_at}</span>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={() => handleDownload(doc.id, doc.filename)}
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="下载文档"
                                            >
                                                <Download size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleReject(doc.id)}
                                                className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition-colors"
                                            >
                                                拒绝
                                            </button>
                                            <button 
                                                onClick={() => handleApprove(doc.id)}
                                                className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md text-sm font-medium transition-colors"
                                            >
                                                通过
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        // QA List
                        loading ? (
                            <div className="text-center py-8 text-gray-500">加载中...</div>
                        ) : qaItems.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">暂无待审批问答</div>
                        ) : (
                            <div className="space-y-4">
                                {qaItems.map(qa => (
                                    <div key={qa.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <div className="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                                            <div className="flex items-center space-x-2">
                                                <span className="font-bold text-gray-700">{qa.username}</span>
                                                <span className="text-gray-400 text-xs">{qa.created_at}</span>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button 
                                                    onClick={() => handleRejectQA(qa.id)}
                                                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition-colors"
                                                >
                                                    拒绝
                                                </button>
                                                <button 
                                                    onClick={() => handleApproveQA(qa.id)}
                                                    className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md text-sm font-medium transition-colors"
                                                >
                                                    通过
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mb-2">
                                            <div className="font-semibold text-gray-600 mb-1">问题：</div>
                                            <div className="text-gray-800 bg-white p-2 rounded border border-gray-100 whitespace-pre-wrap">
                                                {qa.question}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-600 mb-1">答案：</div>
                                            <div className="text-gray-600 bg-blue-50/50 p-2 rounded border border-blue-100/50 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                {qa.answer}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// 学习记录视图
function LearningRecordsView({ userRole, filterScope, filterDate, embed }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        fetchRecords();
    }, [page, filterScope, filterDate]);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            let url = `/admin/learning_records?page=${page}&limit=${limit}`;
            if (filterScope) url += `&scope=${filterScope}`;
            if (filterDate) url += `&filter_date=${filterDate}`;
            
            const res = await axios.get(url);
            setRecords(res.data.records || []);
            setTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("确定要删除这条学习记录吗？删除后将同时从知识库中移除。")) return;
        try {
            await axios.delete(`/admin/delete_qa/${id}`);
            alert("删除成功");
            fetchRecords(); // Refresh list
        } catch (e) {
            alert("删除失败: " + (e.response?.data?.detail || e.message));
        }
    };

    return (
        <div className={`h-full flex flex-col ${embed ? '' : 'bg-gray-50 p-6'} overflow-hidden`}>
            {!embed && (
                <h2 className="text-xl font-bold mb-4 text-green-700 flex items-center">
                    <Database size={24} className="mr-2" />
                    进化历程
                </h2>
            )}

            <div className={`flex-1 overflow-auto ${embed ? '' : 'bg-white rounded-lg shadow'}`}>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="p-3 font-medium text-gray-600 w-24">ID</th>
                            <th className="p-3 font-medium text-gray-600 w-1/4">问题</th>
                            <th className="p-3 font-medium text-gray-600">答案</th>
                            <th className="p-3 font-medium text-gray-600 w-32">贡献者</th>
                            <th className="p-3 font-medium text-gray-600 w-24">状态</th>
                            <th className="p-3 font-medium text-gray-600 w-40">时间</th>
                            {userRole === 'admin' && (
                                <th className="p-3 font-medium text-gray-600 w-24 text-center">操作</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan={userRole === 'admin' ? 7 : 6} className="p-8 text-center text-gray-500">
                                    暂无学习记录
                                </td>
                            </tr>
                        ) : (
                            records.map(record => (
                                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="p-3 text-gray-500 text-sm">#{record.id}</td>
                                    <td className="p-3 font-medium text-gray-800">{record.question}</td>
                                    <td className="p-3 text-gray-600 text-sm line-clamp-2 max-w-md" title={record.answer}>
                                        {record.answer.length > 100 ? record.answer.substring(0, 100) + '...' : record.answer}
                                    </td>
                                    <td className="p-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                            <User size={10} className="mr-1" />
                                            {record.username || '未知'}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            record.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {record.status === 'approved' ? '已生效' : '待审核'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-500 text-sm">{record.created_at}</td>
                                    {userRole === 'admin' && (
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => handleDelete(record.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                                                title="删除"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > limit && (
                <div className="flex justify-center mt-4 space-x-2">
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        上一页
                    </button>
                    <span className="px-3 py-1 text-gray-600">
                        第 {page} 页 / 共 {Math.ceil(total / limit)} 页
                    </span>
                    <button 
                        disabled={page * limit >= total}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        下一页
                    </button>
                </div>
            )}
        </div>
    );
}

// 获取当前时间
const getCurrentTime = () => {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// 用户提问记录视图
function UserLogsView() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;
    const [zoomImage, setZoomImage] = useState(null);

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/admin/chat_logs?page=${page}&limit=${limit}&scope=me`);
            setLogs(res.data.logs || []);
            setTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
            setLogs([]); // Ensure logs is an array on error
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (id, filename) => {
        try {
            const response = await axios.get(`/download_source/${id}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert("下载失败: " + (e.response?.data?.detail || e.message));
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
             <div className="max-w-6xl mx-auto w-full h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-bold flex items-center text-gray-800">
                        <FileText className="mr-2 text-blue-600" />
                        提问足迹
                    </h2>
                    <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="刷新">
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">加载中...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">暂无记录</div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map(log => (
                                <div key={log.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
                                    <div className="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-gray-700">{log.username}</span>
                                            <span className="text-gray-400 text-xs">{log.created_at}</span>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="font-semibold text-gray-600 mb-1">提问：</div>
                                        <div className="text-gray-800 bg-white p-2 rounded border border-gray-100 whitespace-pre-wrap">
                                            {log.question}
                                        </div>
                                        {log.image_path && (
                                            <div className="mt-2">
                                                <img 
                                                    src={`/user_images/${log.image_path}`} 
                                                    alt="User Upload" 
                                                    className="h-24 rounded border cursor-zoom-in hover:opacity-90"
                                                    onClick={() => setZoomImage(`/user_images/${log.image_path}`)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-600 mb-1">回答：</div>
                                        <div className="text-gray-600 bg-blue-50/50 p-2 rounded border border-blue-100/50 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                            {log.answer}
                                        </div>
                                        {log.sources && log.sources.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-gray-200/50">
                                                <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center">
                                                    <FileText size={12} className="mr-1" />
                                                    参考文档
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {log.sources.map((src, idx) => (
                                                        <div key={idx} className="flex items-center bg-white text-xs text-gray-600 px-2 py-1 rounded border border-gray-200">
                                                            <span className="max-w-[150px] truncate mr-2" title={src.filename}>{src.filename}</span>
                                                            {src.id ? (
                                                                <button 
                                                                    onClick={() => handleDownload(src.id, src.filename)}
                                                                    className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50"
                                                                    title="下载"
                                                                >
                                                                    <Download size={12} />
                                                                </button>
                                                            ) : (
                                                                <span className="text-gray-400 text-[10px]">(未索引)</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Pagination */}
                <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-500">
                    <span>共 {total} 条记录</span>
                    <div className="flex space-x-2">
                        <button 
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <span className="px-2 py-1">第 {page} 页</span>
                        <button 
                            disabled={page * limit >= total}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>
            
            {zoomImage && (
                <div 
                  className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center cursor-zoom-out"
                  onClick={() => setZoomImage(null)}
                >
                    <button 
                        onClick={() => setZoomImage(null)}
                        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-50"
                    >
                        <X size={24} />
                    </button>
                  <img src={zoomImage} className="max-h-screen max-w-screen object-contain p-4" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}

// 全局日志视图 (Admin Only)
function GlobalLogsView() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/admin/global_logs?page=${page}&limit=${limit}`);
            setLogs(res.data.logs || []);
            setTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await axios.get('/admin/export_global_logs', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'global_logs.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert("导出失败: " + (e.response?.data?.detail || e.message));
        }
    };

    const renderLogItem = (log) => {
        // Status Colors
        const statusColors = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'approved': 'bg-green-100 text-green-800',
            'rejected': 'bg-red-100 text-red-800',
            'completed': 'bg-blue-100 text-blue-800',
            'normal': 'bg-gray-100 text-gray-800',
        };
        const statusLabel = statusColors[log.status] || 'bg-gray-100 text-gray-800';

        let icon = FileText;
        let typeLabel = "未知";
        
        switch(log.type) {
            case 'chat':
                icon = Bot;
                typeLabel = "智能问答";
                break;
            case 'doc_upload':
                icon = UploadCloud;
                typeLabel = "文档上传";
                break;
            case 'qa_submission':
                icon = Target;
                typeLabel = "知识录入";
                break;
            default:
                break;
        }

        const Icon = icon;

        return (
            <div key={`${log.type}-${log.id}`} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600`}>
                            {typeLabel}
                        </span>
                        <span className="font-bold text-gray-700">{log.username}</span>
                        <span className="text-gray-400 text-xs">{log.created_at}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusLabel}`}>
                        {log.status}
                    </span>
                </div>
                
                <div className="mb-1">
                    <div className="font-medium text-gray-800">{log.content}</div>
                </div>
                
                {log.details && (
                    <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded mt-2 truncate">
                        {log.type === 'doc_upload' ? `路径: ${log.details}` : `回复/详情: ${log.details}`}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
             <div className="max-w-6xl mx-auto w-full h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-bold flex items-center text-gray-800">
                        <Globe className="mr-2 text-blue-600" />
                        全局日志
                    </h2>
                    <div className="flex space-x-2">
                        <button onClick={handleExport} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="导出全部">
                            <Download size={20} className="text-gray-600" />
                        </button>
                        <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="刷新">
                            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">加载中...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">暂无记录</div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map(renderLogItem)}
                        </div>
                    )}
                </div>
                
                {/* Pagination */}
                <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-500">
                    <span>共 {total} 条记录</span>
                    <div className="flex space-x-2">
                        <button 
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <span className="px-2 py-1">第 {page} 页</span>
                        <button 
                            disabled={page * limit >= total}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 未知问题学习视图
function UnknownQuestionsView({ userRole }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;
    
    // Learning state
    const [editingId, setEditingId] = useState(null);
    const [learnAnswer, setLearnAnswer] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [polishing, setPolishing] = useState(false);
    const [prePolishAnswer, setPrePolishAnswer] = useState("");

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/admin/unknown_questions?page=${page}&limit=${limit}`);
            setLogs(res.data.logs || []);
            setTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleLearn = (log) => {
        setEditingId(log.id);
        setLearnAnswer(""); 
    };

    const submitLearn = async () => {
        if (!learnAnswer.trim()) return;
        setSubmitting(true);
        try {
            await axios.post('/admin/learn', {
                question_id: editingId,
                answer: learnAnswer
            });
            // Refresh list
            fetchLogs();
            setEditingId(null);
            setLearnAnswer("");
        } catch (e) {
            alert("学习失败: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDiscard = async (id) => {
        if (!window.confirm("确定要丢弃该问题吗？丢弃后将不再出现在此处。")) return;
        try {
            await axios.post(`/admin/discard_unknown/${id}`);
            fetchLogs();
        } catch (e) {
            alert("操作失败: " + e.message);
        }
    };

    const handlePolish = async (question) => {
        if (!learnAnswer.trim()) {
          alert("请先填写草稿答案，AI才能帮您润色");
          return;
        }
        setPrePolishAnswer(learnAnswer); // Save current answer before polishing
        setPolishing(true);
        try {
          const res = await axios.post('/admin/polish_answer', { 
            question, 
            draft_answer: learnAnswer 
          });
          if (res.data.status === 'success') {
            setLearnAnswer(res.data.polished_answer);
          }
        } catch (e) {
          alert("润色失败: " + (e.response?.data?.detail || e.message));
        } finally {
          setPolishing(false);
        }
    };

    const handleKeyDown = (e) => {
        // Ctrl+Z to undo polish
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            if (prePolishAnswer) {
                e.preventDefault();
                setLearnAnswer(prePolishAnswer);
                setPrePolishAnswer(""); // Clear after undo
            }
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
             <div className="max-w-6xl mx-auto w-full h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-bold flex items-center text-gray-800">
                        <Sparkles className="mr-2 text-purple-600" />
                        未知问题
                    </h2>
                    <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="刷新">
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">加载中...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">暂无未知问题</div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map(log => (
                                <div key={log.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
                                    <div className="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-gray-700">{log.username}</span>
                                            <span className="text-gray-400 text-xs">{log.created_at}</span>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="font-semibold text-gray-600 mb-1">提问：</div>
                                        <div className="text-gray-800 bg-white p-2 rounded border border-gray-100 whitespace-pre-wrap">
                                            {log.question}
                                        </div>
                                    </div>
                                    
                                    {/* Edit Area */}
                                    {editingId === log.id ? (
                                        <div className="mt-3 bg-purple-50 p-3 rounded border border-purple-100 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center">
                                                    <label className="block text-purple-800 font-medium mr-2">请输入标准答案：</label>
                                                    {prePolishAnswer && (
                                                        <span className="text-xs text-gray-400">按 Ctrl+Z 撤销润色</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handlePolish(log.question)}
                                                    disabled={polishing || !learnAnswer.trim()}
                                                    className="flex items-center text-xs text-purple-600 hover:text-purple-700 bg-white border border-purple-200 hover:border-purple-300 px-3 py-1 rounded-full transition-colors disabled:opacity-50"
                                                >
                                                    <Sparkles size={14} className={cn("mr-1", polishing ? "animate-spin" : "")} />
                                                    {polishing ? "AI 正在润色..." : "AI 润色优化"}
                                                </button>
                                            </div>
                                            <textarea 
                                                className="w-full p-2 border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none min-h-[100px]"
                                                placeholder="在此输入答案，提交后系统将自动学习..."
                                                value={learnAnswer}
                                                onChange={e => setLearnAnswer(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                            />
                                            <div className="flex justify-end space-x-2 mt-2">
                                                <button 
                                                    onClick={() => setEditingId(null)}
                                                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                                                >
                                                    取消
                                                </button>
                                                <button 
                                                    onClick={submitLearn}
                                                    disabled={submitting || !learnAnswer.trim()}
                                                    className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center"
                                                >
                                                    {submitting ? '提交中...' : '确认学习'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end mt-2 space-x-2">
                                            {userRole === 'admin' && (
                                                <button 
                                                    onClick={() => handleDiscard(log.id)}
                                                    className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                                                >
                                                    <X size={14} className="mr-1.5" />
                                                    丢弃
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleLearn(log)}
                                                className="flex items-center px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-md text-sm font-medium transition-colors"
                                            >
                                                <Sparkles size={14} className="mr-1.5" />
                                                去教学
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Pagination */}
                <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-500">
                    <span>共 {total} 条记录</span>
                    <div className="flex space-x-2">
                        <button 
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <span className="px-2 py-1">第 {page} 页</span>
                        <button 
                            disabled={page * limit >= total}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 上传模态框组件
function UploadModal({ isOpen, onClose, onUpload, userRole }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [rescanning, setRescanning] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      
      // Check file size (100MB limit)
      const oversized = selectedFiles.filter(f => f.size > 100 * 1024 * 1024);
      if (oversized.length > 0) {
        setMessage(`❌ 以下文件超过100MB限制: ${oversized.map(f => f.name).join(', ')}`);
        // Clear input
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      
      setFiles(selectedFiles);
      setMessage('');
    }
  };

  const handleUpload = async (targetKb = 'admin') => {
    if (files.length === 0) return;

    setUploading(true);
    setMessage('');

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    // Add target_kb
    formData.append('target_kb', targetKb);

    try {
      const response = await axios.post('/upload_doc', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const results = response.data.results;
      const errors = results.filter(r => r.status === 'error');
      const pending = results.filter(r => r.status === 'pending');
      
      if (errors.length > 0) {
        setMessage(`❌ 部分文件上传失败: ${errors.map(e => e.filename).join(', ')}`);
      } else if (pending.length > 0) {
        setMessage(`⏳ ${pending.length} 个文件已提交，等待管理员审批`);
        setTimeout(() => {
          onUpload(results.map(r => r.filename).join(', '), true);
          onClose();
          setFiles([]);
          setMessage('');
        }, 2000);
      } else {
        setMessage(`✅ ${results.length} 个文件全部上传成功！`);
        setTimeout(() => {
          onUpload(results.map(r => r.filename).join(', '), false);
          onClose();
          setFiles([]);
          setMessage('');
        }, 1500);
      }
    } catch (error) {
      setMessage(`❌ 上传请求失败: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRescan = async () => {
    setRescanning(true);
    setMessage('正在同步知识库（新增/剔除），请稍候...');
    try {
        const res = await axios.post('/reprocess_docs');
        setMessage(`✅ ${res.data.message}`);
    } catch (e) {
        setMessage(`❌ 更新失败: ${e.message}`);
    } finally {
        setRescanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <UploadCloud className="mr-2 text-blue-600" />
          批量上传文档
        </h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
             onClick={() => fileInputRef.current?.click()}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple
            accept=".txt,.md,.docx,.pdf,.xlsx,.xls,.csv"
          />
          <FileText size={48} className="text-gray-400 mb-2" />
          <div className="text-sm text-gray-500 text-center">
            {files.length > 0 ? (
              <div className="text-blue-600 font-medium max-h-32 overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i}>{f.name}</div>
                ))}
                <div className="text-gray-400 mt-1">共 {files.length} 个文件</div>
              </div>
            ) : "点击选择多个文件或拖拽至此"}
          </div>
          <p className="text-xs text-gray-400 mt-1">支持 .txt, .md, .docx, .pdf, .xlsx, .csv</p>
        </div>

        {userRole === 'guest' && (
           <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-start">
              <Shield size={14} className="mr-1 mt-0.5 flex-shrink-0" />
              <span>注意：临时用户仅可体验问答功能，暂不支持上传知识库文件。</span>
           </div>
        )}

        {userRole === 'user' && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 flex items-start">
             <Shield size={14} className="mr-1 mt-0.5 flex-shrink-0" />
             <span>注意：您上传的文档需要经过管理员审批，审批通过后才会正式存入知识库。</span>
          </div>
        )}

        {message && (
          <div className={cn("mt-4 text-sm p-2 rounded", message.startsWith('✅') ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
            {message}
          </div>
        )}

        <div className="mt-6 flex justify-between items-center">
          {userRole === 'admin' && (
            <button
              onClick={handleRescan}
              disabled={rescanning || uploading}
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center transition-colors"
              title="扫描并同步文件：入库新增文件，剔除已删除文件"
            >
              <RefreshCw size={14} className={cn("mr-1", rescanning && "animate-spin")} />
              {rescanning ? "同步中..." : "扫描增量文件"}
            </button>
          )}

          <div className="flex space-x-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
                取消
            </button>
            
            {userRole === 'admin' ? (
              <>
                <button 
                    onClick={() => handleUpload('admin')}
                    disabled={files.length === 0 || uploading}
                    className={cn(
                    "px-4 py-2 rounded-lg text-white transition-colors flex items-center text-sm",
                    files.length === 0 || uploading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                    )}
                >
                    {uploading ? "..." : `运维知识库`}
                </button>
                <button 
                    onClick={() => handleUpload('user')}
                    disabled={files.length === 0 || uploading}
                    className={cn(
                    "px-4 py-2 rounded-lg text-white transition-colors flex items-center text-sm",
                    files.length === 0 || uploading ? "bg-green-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                    )}
                >
                    {uploading ? "..." : `用户知识库`}
                </button>
              </>
            ) : (
                <button 
                    onClick={() => handleUpload('user')}
                    disabled={files.length === 0 || uploading || userRole === 'guest'}
                    className={cn(
                    "px-4 py-2 rounded-lg text-white transition-colors flex items-center",
                    files.length === 0 || uploading || userRole === 'guest' ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                    )}
                >
                    {uploading ? (
                        <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        上传中...
                        </>
                    ) : `开始上传 (${files.length})`}
                </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ChatInterface({ auth, onLogout, isUserMode }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 Ops Agent 助手。有什么我可以帮你的吗？',
      timestamp: getCurrentTime(),
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [hotQuestions, setHotQuestions] = useState([]);
  
  // 截图相关状态
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempScreenshot, setTempScreenshot] = useState(null);
  
  // 图片放大状态
  const [zoomImage, setZoomImage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);

  // 获取热门问题
  useEffect(() => {
    const fetchHotQuestions = async () => {
      try {
        const response = await axios.get('/hot_questions');
        if (response.data.questions) {
          setHotQuestions(response.data.questions);
        }
      } catch (error) {
        console.error('Failed to fetch hot questions:', error);
      }
    };
    fetchHotQuestions();
  }, []);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, selectedImage]);

  // 处理图片选择
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  };

  // 处理文档上传
  const handleDocSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 创建 FormData
    const formData = new FormData();
    formData.append('file', file);

    // 添加一个临时消息表示正在上传
    const uploadMsgId = Date.now().toString();
    setMessages((prev) => [...prev, {
      id: uploadMsgId,
      role: 'assistant',
      content: `📄 正在上传并解析文档：${file.name}...`,
      timestamp: getCurrentTime(),
    }]);

    try {
      const response = await axios.post('/upload_doc', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.error) {
         throw new Error(response.data.error);
      }
      
      setMessages((prev) => prev.map(msg => 
        msg.id === uploadMsgId 
        ? { ...msg, content: `✅ 文档 **${file.name}** 已成功上传并加入知识库！` }
        : msg
      ));
    } catch (error) {
      console.error('Upload Error:', error);
      setMessages((prev) => prev.map(msg => 
        msg.id === uploadMsgId 
        ? { ...msg, content: `❌ 文档上传失败：${error.message || '未知错误'}` }
        : msg
      ));
    }
    
    // 重置 input
    e.target.value = '';
  };

  // 处理粘贴图片
  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImage(reader.result);
        };
        reader.readAsDataURL(blob);
        e.preventDefault(); // 阻止粘贴文件名到输入框
        return;
      }
    }
  };

  // 屏幕截图功能
  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      // 等待视频加载并截取第一帧
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageDataUrl = canvas.toDataURL("image/png");
          
          // 设置临时截图并打开裁剪模态框
          setTempScreenshot(imageDataUrl);
          setShowCropModal(true);
          
          // 停止所有轨道
          stream.getTracks().forEach(track => track.stop());
        }, 500); // 稍微延迟以确保捕获到内容
      };
    } catch (err) {
      console.error("Error capturing screen:", err);
    }
  };

  // 处理发送消息
  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const currentInput = input;
    const currentImage = selectedImage;

    // 清空输入
    setInput('');
    setSelectedImage(null);

    // 添加用户消息
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      image: currentImage,
      timestamp: getCurrentTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // 调用后端 API
      const response = await axios.post('/get_answer', {
        question: currentInput || "请分析这张图片", // 如果只有图片，提供默认文本
        image: currentImage,
      });

      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.answer,
        question_id: response.data.question_id,
        sources: response.data.sources, // Store sources
        timestamp: getCurrentTime(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('API Error:', error);
      const errorMessage = error.response?.data?.detail || error.message || '无法连接到服务器';
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**错误**：${errorMessage}。请稍后再试。`,
        timestamp: getCurrentTime(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      // 保持焦点
      if (window.innerWidth > 768) {
        inputRef.current?.focus();
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 处理反馈
  const handleFeedback = async (msgId, status) => {
    // 找到对应的消息
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    // 更新前端状态
    setMessages(prev => prev.map(m => 
      m.id === msgId ? { ...m, feedback: status } : m
    ));

    // 如果有 question_id，发送反馈到后端
    if (msg.question_id) {
      try {
        await axios.post('/feedback', {
          question_id: msg.question_id,
          status: status
        });
      } catch (error) {
        console.error('Error sending feedback:', error);
      }
    }
  };

  const handleDownload = async (id, filename) => {
      try {
          const response = await axios.get(`/download_source/${id}`, {
              responseType: 'blob',
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (e) {
          alert("下载失败: " + (e.response?.data?.detail || e.message));
      }
  };

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 font-sans relative">
      {/* 普通用户顶部导航栏 */}
      {isUserMode && (
        <div className="h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-6 bg-white shadow-sm z-10 flex-shrink-0">
           <div className="flex items-center space-x-3">
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm text-xs">综资</div>
               <span className="font-bold text-gray-800 text-lg tracking-tight">Ops Agent</span>
           </div>
           <div className="flex items-center space-x-2 md:space-x-4">
               {/* 用户角色标识 */}
               {auth?.role === 'guest' && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                    临时用户（受限权限）
                  </span>
               )}
               {auth?.role === 'user' && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    正式用户
                  </span>
               )}

               {/* 上传按钮已移除，保留左侧菜单的上传入口 */}

               <div className="flex items-center space-x-2">
                   <span className="text-xs text-gray-500 hidden md:inline">{auth.username}</span>
                   <button onClick={onLogout} className="text-gray-500 hover:text-red-600 transition-colors flex items-center space-x-1 p-1" title="退出登录">
                       <LogOut size={18} />
                       <span className="text-sm hidden md:inline">退出</span>
                   </button>
               </div>
           </div>
        </div>
      )}

      {/* 裁剪模态框 */}
      {showCropModal && tempScreenshot && (
        <CropModal 
          imageSrc={tempScreenshot}
          onConfirm={(croppedImage) => {
            setSelectedImage(croppedImage);
            setShowCropModal(false);
            setTempScreenshot(null);
          }}
          onCancel={() => {
            setShowCropModal(false);
            setTempScreenshot(null);
          }}
        />
      )}

      {/* 图片放大模态框 */}
      <ImageZoomModal 
        imageSrc={zoomImage} 
        onClose={() => setZoomImage(null)} 
      />

      <UploadModal 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)}
        onUpload={(filenames, isPending) => {
          if (isPending) {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: `✅ 文件 **${filenames}** 已上传，等待管理员审批通过后生效。`,
              timestamp: getCurrentTime()
            }]);
          } else {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: `✅ 文件 **${filenames}** 已成功上传并加入知识库！`,
              timestamp: getCurrentTime()
            }]);
          }
        }}
        userRole={auth?.role}
      />

      {/* 隐藏的文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocSelect}
        accept=".txt,.md,.docx,.pdf,.xlsx,.xls,.csv"
        className="hidden"
      />

      {/* 消息列表区域 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length <= 1 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-8 mt-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 p-6 rounded-full"
              >
                <Sparkles size={48} className="text-blue-600" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">我是您的运维智能助手</h2>
                <p className="text-gray-500 mt-2">您可以询问故障排查、系统状态或上传截图进行分析</p>
              </div>

              {/* 热门问题 Top 10 */}
              {hotQuestions.length > 0 && (
                <div className="w-full max-w-2xl mt-8">
                  <div className="flex items-center justify-center gap-2 mb-4 text-gray-500">
                     <span className="text-sm font-medium">🔥 热门提问 Top 10</span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {hotQuestions.map((q, index) => (
                      <motion.button
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setInput(q)}
                        className="px-4 py-2 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-full text-sm text-gray-600 transition-all shadow-sm"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex w-full mb-6",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex max-w-[90%] md:max-w-[80%] gap-4",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                {/* 头像 */}
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1",
                  msg.role === 'user' ? "bg-blue-600 text-white" : "bg-white border border-gray-200"
                )}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} className="text-purple-600" />}
                </div>

                {/* 内容 */}
                <div className={cn(
                  "flex flex-col space-y-2",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  {/* 消息气泡 */}
                  <div className={cn(
                    "relative px-5 py-3 rounded-2xl text-base leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-blue-600 text-white rounded-tr-sm" 
                      : "bg-transparent text-gray-800 p-0" // Bot 消息无背景
                  )}>
                    {/* 如果有图片 */}
                    {msg.image && (
                      <div className="mb-2">
                        <img 
                          src={msg.image} 
                          alt="User Upload" 
                          className="max-w-full max-h-64 rounded-lg border border-gray-200/20 cursor-zoom-in hover:opacity-95 transition-opacity" 
                          onClick={() => setZoomImage(msg.image)}
                          title="点击放大查看"
                        />
                      </div>
                    )}
                    
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-slate max-w-none prose-p:my-1 prose-headings:my-2 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:text-gray-800">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}

                    {/* 参考文档 */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-200/50">
                        <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center">
                          <FileText size={12} className="mr-1" />
                          参考文档
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src, idx) => (
                            <div key={idx} className="flex items-center bg-gray-50 text-xs text-gray-600 px-2 py-1.5 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                               <span className="max-w-[180px] truncate mr-2" title={src.filename}>{src.filename}</span>
                               {src.id ? (
                                 (auth?.role !== 'guest') && (
                                 <button 
                                   onClick={() => handleDownload(src.id, src.filename)}
                                   className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50"
                                   title="下载"
                                 >
                                   <Download size={14} />
                                 </button>
                                 )
                               ) : (
                                 <span className="text-gray-400 text-[10px]">(未索引ID)</span>
                               )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                  
                  {/* 反馈按钮 */}
                  {msg.role === 'assistant' && msg.id !== 'welcome' && (
                    <div className="flex items-center space-x-3 px-2 pt-1">
                      <span className="text-xs text-gray-400">是否解决了您的问题？</span>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleFeedback(msg.id, 'solved')}
                          className={cn(
                            "flex items-center space-x-1 px-2 py-0.5 rounded-full transition-colors text-xs border",
                            msg.feedback === 'solved' 
                              ? "bg-green-100 text-green-700 border-green-200" 
                              : "text-gray-500 hover:bg-gray-100 border-transparent bg-gray-50"
                          )}
                        >
                          <ThumbsUp size={12} className={cn(msg.feedback === 'solved' && "fill-current")} />
                          <span>已解决</span>
                        </button>
                        <button 
                          onClick={() => handleFeedback(msg.id, 'unsolved')}
                          className={cn(
                            "flex items-center space-x-1 px-2 py-0.5 rounded-full transition-colors text-xs border",
                            msg.feedback === 'unsolved' 
                              ? "bg-red-100 text-red-700 border-red-200" 
                              : "text-gray-500 hover:bg-gray-100 border-transparent bg-gray-50"
                          )}
                        >
                          <ThumbsDown size={12} className={cn(msg.feedback === 'unsolved' && "fill-current")} />
                          <span>未解决</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          
          {loading && (
            <div className="flex w-full justify-start mb-6">
              <div className="flex max-w-[80%] gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 bg-white border border-gray-200">
                    <Bot size={18} className="text-purple-600" />
                </div>
                <div className="flex items-center h-10 px-4 bg-gray-50 rounded-2xl rounded-tl-none border border-gray-100">
                  <span className="text-sm text-purple-600 font-medium animate-pulse">大模型分析中...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 底部输入区域 */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          {/* 输入框容器 */}
          <div className="bg-gray-100 rounded-[2rem] p-2 shadow-inner border border-gray-200 transition-all">
            
            {/* 图片预览 */}
            {selectedImage && (
              <div className="relative inline-block m-2">
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="h-16 w-16 object-cover rounded-lg border border-gray-300 cursor-zoom-in" 
                  onDoubleClick={() => setZoomImage(selectedImage)}
                  title="双击放大查看"
                />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-gray-500 text-white rounded-full p-0.5 hover:bg-gray-700"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* 文本输入 */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="向我提问..."
              rows={1}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none px-4 py-3 text-gray-700 placeholder-gray-400 min-h-[48px] max-h-32 overflow-y-auto"
              style={{ height: input.trim() ? 'auto' : '48px' }}
            />

            {/* 工具栏 */}
            <div className="flex items-center justify-between px-2 pb-1 pt-1">
              <div className="flex items-center space-x-1">
                <ToolButton icon={ImageIcon} label="图片" onClick={() => fileInputRef.current?.click()} active={!!selectedImage} />
                {false && (
                  <ToolButton icon={Scissors} label="截图" onClick={handleScreenCapture} />
                )}
                {/* 仅在非用户模式（管理员）或用户模式下底部不显示时显示？ */}
                {/* 管理员界面没有顶部导航，必须保留底部按钮 */}
                {/* 普通用户界面已有顶部上传按钮，底部可隐藏以保持原样，或者保留方便操作 */}
                {/* 用户反馈说上面的没了，说明他们习惯用上面的。为了还原，我们把下面的对普通用户隐藏 */}
                {/* 用户要求移除提问窗口下方的上传知识库按钮，只保留左侧菜单下方的 */}
              </div>
              
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !selectedImage) || loading}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  (!input.trim() && !selectedImage) || loading 
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                    : "bg-black text-white hover:bg-gray-800"
                )}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          
          <div className="text-center mt-2 text-xs text-gray-400 space-y-1">
            <p>问答将被记录 请勿询问和上传敏感信息</p>
            <p>AI 生成的内容可能不准确，请核实重要信息。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 底部工具按钮组件
function ToolButton({ icon: Icon, label, onClick, active }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors relative group",
        active && "bg-blue-100 text-blue-600"
      )}
      title={label}
    >
      <Icon size={20} strokeWidth={1.5} />
      {/* Tooltip */}
      <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {label}
      </span>
    </button>
  );
}

function App() {
  const [auth, setAuth] = useState(JSON.parse(localStorage.getItem('auth')) || null);
  const [activeView, setActiveView] = useState('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showGlobalUpload, setShowGlobalUpload] = useState(false);

  useEffect(() => {
      const handleResize = () => {
          setIsMobile(window.innerWidth < 768);
          if (window.innerWidth >= 768) {
              setIsSidebarOpen(true); // Desktop: always open (relative)
          } else {
              setIsSidebarOpen(false); // Mobile: default closed
          }
      };
      
      window.addEventListener('resize', handleResize);
      handleResize(); // init
      
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setAuth(null);
  };

  const handleViewChange = (viewId) => {
      setActiveView(viewId);
      if (isMobile) {
          setIsSidebarOpen(false);
      }
  };

  if (!auth) {
      return (
        <Routes>
            <Route path="/login" element={<Login setAuth={setAuth} />} />
            <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 animate-in fade-in" 
            onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed md:relative z-50 h-full transition-transform duration-300 ease-in-out",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop override to make it always visible if we want, or controlled by same state
        // Here we use same state but init it to true on desktop. 
        // But 'fixed md:relative' means on desktop it is relative flow.
        // If we want it collapsible on desktop, we need different logic.
        // For now, let's assume always visible on desktop.
        "md:translate-x-0"
      )}>
        <Sidebar 
            activeView={activeView} 
            onViewChange={handleViewChange} 
            userRole={auth.role} 
            username={auth.username}
            onLogout={handleLogout} 
            onUpload={() => setShowGlobalUpload(true)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full w-full relative bg-white md:bg-gray-50">
         {/* Mobile Header (Hamburger) */}
         <div className="md:hidden p-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <Menu size={24} className="text-gray-700" />
                </button>
                <span className="font-bold text-gray-800 text-lg">Ops Agent</span>
            </div>
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {auth.username}
            </div>
         </div>
         
         {/* View Content */}
         <div className="flex-1 overflow-hidden relative">
            {activeView === 'chat' && <ChatInterface auth={auth} onLogout={handleLogout} />}
            {activeView === 'training' && <TrainingMode />}
            {activeView === 'approval' && <AdminView />}
            {activeView === 'global_logs' && <GlobalLogsView />}
            {activeView === 'unknown' && <UnknownQuestionsView userRole={auth.role} />}
            {activeView === 'learning' && <LearningRecordsView userRole={auth.role} />}
            {activeView === 'knowledge' && <KnowledgeDocs auth={auth} onUpload={() => setShowGlobalUpload(true)} />}
            {activeView === 'dashboard' && <DashboardView userRole={auth.role} />}
         </div>
      </div>

      <UploadModal 
        isOpen={showGlobalUpload} 
        onClose={() => setShowGlobalUpload(false)}
        onUpload={(filenames) => {
           setShowGlobalUpload(false);
           // Optional: Show toast or simple alert
           // alert(`文件上传成功: ${filenames}`); 
        }}
        userRole={auth?.role}
      />
    </div>
  );
}

export default App;

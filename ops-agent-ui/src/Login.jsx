import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, ShieldCheck, User, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login({ setAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  
  const [error, setError] = useState('');
  const [hotQuestions, setHotQuestions] = useState([]);
  const navigate = useNavigate();

  const fetchCaptcha = async () => {
      try {
          const res = await axios.get('/captcha');
          setCaptchaId(res.data.captcha_id);
          setCaptchaImage(res.data.image);
          setCaptchaCode(''); // clear input
      } catch (err) {
          console.error("Fetch captcha failed", err);
      }
  };

  useEffect(() => {
    fetchCaptcha();
    // Fetch hot questions
    axios.get('/hot_questions')
      .then(res => {
        if (res.data.questions) {
          setHotQuestions(res.data.questions);
        }
      })
      .catch(err => console.error('Failed to fetch hot questions:', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (isRegister) {
        if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }
        // Register doesn't strictly require captcha in backend code yet, but good practice.
        // Wait, backend /register implementation does NOT verify captcha in main.py yet!
        // I only added it to /token.
        // But the user request said "Login with captcha".
        // I will add captcha verification to /register in backend too if needed. 
        // For now, let's just focus on Login or update backend /register.
        // Actually, let's update backend /register to accept captcha too, or just Login.
        // The user said "登陆时". So Login is priority.
        // But consistency...
        // Let's implement it for login first.
        
        try {
            const response = await axios.post('/register', { username, password });
            const { access_token, role, username: user } = response.data;
            
            const authData = { token: access_token, role, username: user };
            localStorage.setItem('auth', JSON.stringify(authData));
            
            setAuth(authData);
            navigate('/');
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail;
            if (detail) {
               setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
            } else {
               setError('注册失败，请稍后重试');
            }
            fetchCaptcha(); // Refresh captcha on error
        }
    } else {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('captcha_id', captchaId);
        formData.append('captcha_code', captchaCode);

        try {
          const response = await axios.post('/token', formData);
          const { access_token, role, username: user } = response.data;
          
          const authData = { token: access_token, role, username: user };
          localStorage.setItem('auth', JSON.stringify(authData));
          
          setAuth(authData);
          navigate('/');
        } catch (err) {
          console.error(err);
          const detail = err.response?.data?.detail;
          if (detail) {
             setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
          } else {
             setError('登录失败，请检查网络连接或用户名密码');
          }
          fetchCaptcha(); // Refresh captcha on error
        }
    }
  };

  const handleGuestLogin = async () => {
      try {
          const response = await axios.post('/guest-token');
          const { access_token, role, username: user } = response.data;
          
          const authData = { token: access_token, role, username: user };
          localStorage.setItem('auth', JSON.stringify(authData));
          
          setAuth(authData);
          navigate('/');
      } catch (err) {
          console.error(err);
          setError('临时登录失败，请稍后重试');
      }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Branding & Info (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 flex-col relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
             <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
             <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '2s'}}></div>
             <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="relative z-10 flex flex-col h-full p-12 justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">综资</div>
                <h1 className="text-xl font-bold text-gray-800">Ops Agent</h1>
            </div>

            {/* Main Content */}
            <div className="flex flex-col items-center text-center max-w-lg mx-auto">
                <div className="bg-white p-4 rounded-2xl shadow-sm mb-8 border border-gray-100">
                    <Sparkles className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">我是您的运维智能助手</h2>
                <p className="text-gray-500 mb-12 text-lg">
                    您可以询问故障排查、系统状态或上传截图进行分析
                </p>
                
                {/* Hot Questions */}
                <div className="w-full">
                    <div className="flex items-center justify-center space-x-2 mb-4 text-gray-500 text-sm font-medium">
                        <span>🔥 热门提问 Top 10</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        {hotQuestions.slice(0, 8).map((q, i) => (
                            <div key={i} className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 shadow-sm hover:border-blue-300 transition-colors cursor-default">
                                {q}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="text-center text-xs text-gray-400">
                &copy; 2026 Ops Agent System. All rights reserved.
            </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-gray-900">
                    {isRegister ? '创建新账号' : '欢迎回来'}
                </h2>
                <p className="mt-2 text-gray-500">
                    {isRegister ? '注册后即可访问用户版知识库' : '请登录以访问您的工作台'}
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none bg-gray-50 focus:bg-white"
                        placeholder="请输入用户名"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none bg-gray-50 focus:bg-white pr-10"
                            placeholder="请输入密码"
                            required
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                    </div>
                </div>

                {isRegister && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none bg-gray-50 focus:bg-white pr-10"
                                placeholder="请再次输入密码"
                                required
                            />
                        </div>
                    </div>
                )}

                {!isRegister && captchaImage && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={captchaCode}
                                onChange={(e) => setCaptchaCode(e.target.value)}
                                className="w-1/2 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none bg-gray-50 focus:bg-white"
                                placeholder="验证码"
                                required
                            />
                            <div className="w-1/2 rounded-lg overflow-hidden cursor-pointer border border-gray-200 flex items-center justify-center bg-gray-50" onClick={fetchCaptcha} title="点击刷新验证码">
                                <img src={captchaImage} alt="CAPTCHA" className="h-10 object-contain" />
                            </div>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-lg shadow-blue-600/30"
                >
                    {isRegister ? '立即注册' : '立即登录'}
                </button>
            </form>

            <div className="space-y-4">
                <button 
                    type="button" 
                    onClick={() => {
                        setIsRegister(!isRegister); 
                        setError(''); 
                        setUsername(''); 
                        setPassword(''); 
                        setConfirmPassword('');
                    }} 
                    className="w-full text-center text-sm text-blue-600 hover:underline"
                >
                    {isRegister ? '已有账号？立即登录' : '没有账号？立即注册'}
                </button>

                {!isRegister && (
                    <div className="pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={handleGuestLogin}
                            className="w-full bg-green-50 text-green-700 py-3 rounded-lg font-medium hover:bg-green-100 transition-colors border border-green-200 flex items-center justify-center space-x-2"
                        >
                            <User size={18} />
                            <span>临时登录 (访客模式)</span>
                        </button>
                    </div>
                )}
            </div>


        </div>
      </div>
    </div>
  );
}
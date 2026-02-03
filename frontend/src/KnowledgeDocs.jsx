import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { renderAsync } from 'docx-preview';
import { Search, FileText, Download, Eye, TrendingUp, File as FileIcon, Trash2, X, UploadCloud } from 'lucide-react';

export default function KnowledgeDocs({ auth, onUpload }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [docs, setDocs] = useState([]);
    const [hotDocs, setHotDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [previewDoc, setPreviewDoc] = useState(null);
    const limit = 20;

    useEffect(() => {
        fetchHotDocs();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchDocs();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, page]);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/documents/search', {
                params: { q: searchTerm, page, limit }
            });
            setDocs(res.data.docs);
            setTotal(res.data.total);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchHotDocs = async () => {
        try {
            const res = await axios.get('/documents/hot');
            setHotDocs(res.data.docs || []);
        } catch (e) {
            console.error(e);
            setHotDocs([]);
        }
    };

    const handleDownload = async (id, filename) => {
        try {
            const response = await axios.get(`/documents/${id}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            fetchHotDocs();
            fetchDocs();
        } catch (e) {
            alert("下载失败: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleDelete = async (id, filename) => {
        if (!window.confirm(`确定要删除文档 "${filename}" 吗？\n删除后将无法恢复，且知识库将同步更新。`)) return;
        try {
            await axios.delete(`/documents/${id}`);
            // Optimistic update
            setDocs(docs.filter(d => d.id !== id));
            setHotDocs(hotDocs.filter(d => d.id !== id));
            alert("删除成功");
            fetchDocs(); // Refresh to be sure
            fetchHotDocs();
        } catch (e) {
            alert("删除失败: " + (e.response?.data?.detail || e.message));
        }
    };

    const handlePreview = (doc) => {
        setPreviewDoc(doc);
        // Refresh stats in background
        setTimeout(() => {
            fetchHotDocs();
            fetchDocs();
        }, 1000);
    };

    const closePreview = () => {
        setPreviewDoc(null);
    };

    // Helper to format file size
    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Preview Content Component
    const PreviewContent = ({ doc }) => {
        const containerRef = useRef(null);
        const [error, setError] = useState(null);
        const ext = doc.filename.split('.').pop().toLowerCase();
        // URL for iframe/img (needs token)
        const fileUrl = `/documents/${doc.id}?preview=true&token=${auth?.token}`;

        useEffect(() => {
            if (ext === 'docx') {
                axios.get(`/documents/${doc.id}`, { responseType: 'blob' })
                    .then(res => {
                        if (containerRef.current) {
                            renderAsync(res.data, containerRef.current, containerRef.current, {
                                className: "docx-viewer",
                                inWrapper: true,
                                ignoreWidth: false,
                            }).catch(e => setError("DOCX 解析失败: " + e.message));
                        }
                    })
                    .catch(e => setError("加载失败: " + e.message));
            }
        }, [doc]);

        if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>;

        if (ext === 'docx') {
            return <div ref={containerRef} className="w-full h-full overflow-auto bg-gray-100 p-8" />;
        }
        
        if (['pdf', 'txt', 'png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
            return <iframe src={fileUrl} className="w-full h-full bg-white border-0" title="preview" />;
        }

        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FileText size={48} className="mb-4 text-gray-300" />
                <p>该文件格式 ({ext}) 暂不支持在线预览</p>
                {auth?.role !== 'guest' && (
                <button 
                    onClick={() => handleDownload(doc.id, doc.filename)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    下载查看
                </button>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
            <div className="max-w-7xl mx-auto w-full h-full flex gap-6">
                
                {/* Main Content: Search and List */}
                <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold flex items-center text-gray-800 mb-4">
                            <FileText className="mr-2 text-blue-600" />
                            知识文档库
                            <button 
                                onClick={onUpload}
                                className="ml-4 flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm shadow-sm"
                            >
                                <UploadCloud size={16} />
                                <span>上传知识库</span>
                            </button>
                        </h2>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1); // Reset to page 1 on search
                                }}
                                placeholder="搜索文档名称..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">加载中...</div>
                        ) : docs.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">未找到相关文档</div>
                        ) : (
                            <div className="space-y-3">
                                {docs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <div className="p-2 bg-white rounded-lg border border-gray-200">
                                                <FileIcon size={24} className="text-blue-500" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-800 flex items-center flex-wrap">
                                                    <span className="mr-2">{doc.filename}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
                                                        doc.kb_type === 'admin' 
                                                            ? 'bg-purple-50 text-purple-600 border-purple-200' 
                                                            : 'bg-green-50 text-green-600 border-green-200'
                                                    }`}>
                                                        {doc.kb_type === 'admin' ? '运维知识库' : '用户知识库'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center space-x-3 mt-1">
                                                    <span>{formatSize(doc.file_size)}</span>
                                                    <span>•</span>
                                                    <span>上传者: {doc.uploader}</span>
                                                    <span>•</span>
                                                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center" title="下载次数">
                                                        <Download size={10} className="mr-1" />
                                                        {doc.download_count}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handlePreview(doc)}
                                                className="px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center text-sm"
                                                title="在线浏览"
                                            >
                                                <Eye size={16} className="mr-1.5" />
                                                在线浏览
                                            </button>
                                            {auth?.role !== 'guest' && (
                                            <button
                                                onClick={() => handleDownload(doc.id, doc.filename)}
                                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="下载"
                                            >
                                                <Download size={18} />
                                            </button>
                                            )}
                                            {auth?.role === 'admin' && (
                                                <button
                                                    onClick={() => handleDelete(doc.id, doc.filename)}
                                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="删除文档"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {total > limit && (
                        <div className="p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-500">
                            <span>共 {total} 个文档</span>
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
                    )}
                </div>

                {/* Sidebar: Hot Downloads */}
                <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hidden lg:flex">
                    <div className="p-4 border-b border-gray-200 bg-orange-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <TrendingUp className="mr-2 text-orange-500" />
                            热门下载 TOP 10
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {hotDocs.length === 0 ? (
                            <div className="text-center text-gray-500 text-sm py-4">暂无数据</div>
                        ) : (
                            <div className="space-y-4">
                                {hotDocs.map((doc, index) => (
                                    <div key={doc.id} className="flex items-start space-x-3 group cursor-pointer" onClick={() => handlePreview(doc)}>
                                        <div className={`
                                            w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                                            ${index < 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}
                                        `}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-700 group-hover:text-blue-600 truncate transition-colors" title={doc.filename}>
                                                {doc.filename}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 flex items-center">
                                                <Download size={10} className="mr-1" />
                                                {doc.download_count} 次下载
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Preview Modal */}
            {previewDoc && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-white rounded-xl w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex items-center space-x-3">
                                <FileText className="text-blue-600" />
                                <h3 className="font-bold text-gray-800 truncate max-w-md" title={previewDoc.filename}>
                                    {previewDoc.filename}
                                </h3>
                            </div>
                            <div className="flex items-center space-x-2">
                                {auth?.role !== 'guest' && (
                                <button 
                                    onClick={() => handleDownload(previewDoc.id, previewDoc.filename)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="下载"
                                >
                                    <Download size={20} />
                                </button>
                                )}
                                <button 
                                    onClick={closePreview}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="关闭"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden relative bg-gray-100">
                            <PreviewContent doc={previewDoc} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

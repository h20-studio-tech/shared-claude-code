import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const PublicSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('sessions');
  const [pagination, setPagination] = useState({ limit: 20, offset: 0, hasMore: false });

  useEffect(() => {
    loadPublicContent();
  }, [activeTab, pagination.limit, pagination.offset]);

  const loadPublicContent = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'sessions') {
        const response = await api.fetch(`/api/sharing/public/sessions?limit=${pagination.limit}&offset=${pagination.offset}`);
        if (!response.ok) throw new Error('Failed to load public sessions');
        
        const data = await response.json();
        setSessions(data.sessions || []);
        setPagination(prev => ({ ...prev, hasMore: data.pagination.hasMore }));
      } else {
        const response = await api.fetch(`/api/sharing/public/projects?limit=${pagination.limit}&offset=${pagination.offset}`);
        if (!response.ok) throw new Error('Failed to load public projects');
        
        const data = await response.json();
        setProjects(data.projects || []);
        setPagination(prev => ({ ...prev, hasMore: data.pagination.hasMore }));
      }
    } catch (error) {
      console.error('Error loading public content:', error);
      setError(`Failed to load public ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openSession = (session) => {
    // Open session in new tab/window for viewing
    if (session.share_token) {
      const url = `/shared/${session.share_token}`;
      window.open(url, '_blank');
    } else {
      // Fallback to session ID
      const url = `/session/${session.id}`;
      window.open(url, '_blank');
    }
  };

  const loadMore = () => {
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
  };

  const resetPagination = () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    resetPagination();
  };

  if (loading && pagination.offset === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Public Claude Code Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Explore public coding sessions shared by the community
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => switchTab('sessions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sessions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => switchTab('projects')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'projects'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Projects
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md">
              {error}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {sessions.length === 0 && !loading ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 dark:text-gray-500 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">No public sessions found</p>
                </div>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => openSession(session)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                          {session.title || 'Untitled Session'}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <span>by {session.owner_display_name || session.owner_username}</span>
                          <span>•</span>
                          <span>{session.project_display_name || session.project_name}</span>
                          <span>•</span>
                          <span>{session.message_count || 0} messages</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Updated {formatDate(session.updated_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                          Public
                        </span>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-4">
              {projects.length === 0 && !loading ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 dark:text-gray-500 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">No public projects found</p>
                </div>
              ) : (
                projects.map(project => (
                  <div
                    key={project.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {project.display_name}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <span>by {project.owner_display_name || project.owner_username}</span>
                          <span>•</span>
                          <span>{project.session_count || 0} public sessions</span>
                        </div>
                        {project.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {project.description}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Updated {formatDate(project.updated_at)}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 ml-4">
                        Public
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Load More Button */}
          {pagination.hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicSessions;
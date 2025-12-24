import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, HelpCircle, Mail, Search, ChevronDown, ChevronRight, 
  MessageSquare, Zap, AlertCircle, CheckCircle, ThumbsUp, ThumbsDown,
  Copy, ExternalLink, Star, Clock, Filter, Download, Play, Pause
} from 'lucide-react';
import { Header } from '../components/layout/Header';

export const HelpPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('guide');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGuideStep, setActiveGuideStep] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<number[]>([]);
  const [helpfulCounts, setHelpfulCounts] = useState<{[key: number]: number}>({});
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const sectionRefs = useRef<{[key: string]: HTMLDivElement | null}>({});

  // Animate section transitions
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.section-content');
    sections.forEach(section => {
      section.classList.remove('animate-slide-in');
      void section.offsetWidth; // Trigger reflow
      section.classList.add('animate-slide-in');
    });
  }, [activeSection]);

  // Simulate helpful counts from localStorage or API
  useEffect(() => {
    const savedCounts = JSON.parse(localStorage.getItem('helpfulCounts') || '{}');
    setHelpfulCounts(savedCounts);
  }, []);

  const sections = [
    { id: 'guide', label: 'User Guide', icon: Book, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 'faq', label: 'FAQ', icon: HelpCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { id: 'contact', label: 'Contact Support', icon: Mail, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  ];

  const guideSteps = [
    {
      title: 'Quick Setup',
      duration: '2 minutes',
      icon: Zap,
      steps: [
        'Login with default credentials (admin/admin)',
        'Navigate to Settings → MQTT Configuration',
        'Enter your broker details (host, port, credentials)',
        'Click "Test Connection" to verify',
        'Save configuration'
      ],
      video: 'mqtt-setup-demo'
    },
    {
      title: 'Dashboard Tour',
      duration: '3 minutes',
      icon: Book,
      steps: [
        'Explore real-time tag activity stream',
        'Monitor statistics cards for quick insights',
        'Analyze 24-hour activity patterns',
        'Check device distribution charts',
        'Set up custom alerts and notifications'
      ],
      video: 'dashboard-tour'
    },
    {
      title: 'Tag Management',
      duration: '4 minutes',
      icon: Filter,
      steps: [
        'Use search and filters to find specific tags',
        'Export data in CSV, Excel, or PDF formats',
        'Set up automated data archiving',
        'Configure retention policies',
        'Monitor tag performance metrics'
      ],
      video: 'tag-management'
    },
    {
      title: 'Device Configuration',
      duration: '5 minutes',
      icon: AlertCircle,
      steps: [
        'Add new RFID readers via device manager',
        'Configure reader settings and zones',
        'Set up location mapping',
        'Monitor device health metrics',
        'Configure alerts for offline devices'
      ],
      video: 'device-config'
    }
  ];

  const faqs = [
    {
      id: 1,
      question: 'How do I connect to the MQTT broker?',
      answer: 'Go to Settings → MQTT Settings and enter your broker details including address, port, and credentials. Click "Save Changes" and the system will automatically attempt to connect.',
      category: 'Setup',
      difficulty: 'Beginner'
    },
    {
      id: 2,
      question: 'Why are some devices showing as offline?',
      answer: 'Devices may show offline if they haven\'t sent a heartbeat in the last 5 minutes. Check the device\'s network connection and ensure it\'s powered on. You can also check the last heartbeat timestamp in the device details.',
      category: 'Troubleshooting',
      difficulty: 'Intermediate'
    },
    {
      id: 3,
      question: 'How do I export tag data?',
      answer: 'Navigate to the Tag Data page, apply any filters you need, then click the "Export" button in the top right. You can choose between CSV, Excel, or PDF formats.',
      category: 'Data Management',
      difficulty: 'Beginner'
    },
    {
      id: 4,
      question: 'What does RSSI mean and why is it important?',
      answer: 'RSSI (Received Signal Strength Indicator) measures the power level of the RFID signal in dBm. Higher values (closer to 0) indicate stronger signals. Typical values range from -30 dBm (very strong) to -80 dBm (weak). This helps in determining tag positioning and antenna optimization.',
      category: 'Technical',
      difficulty: 'Intermediate'
    },
    {
      id: 5,
      question: 'How long is tag data retained?',
      answer: 'Tag data retention is configurable in Settings → System Config. The default is 30 days. After this period, data is automatically archived. You can extend this period or set up custom archiving rules.',
      category: 'Configuration',
      difficulty: 'Beginner'
    },
    {
      id: 6,
      question: 'Can I add multiple users with different permissions?',
      answer: 'Yes, administrators can add and manage users from Settings → User Management. You can create users with "admin", "operator", or "viewer" roles with different permission levels. Each role has specific access rights to system features.',
      category: 'Administration',
      difficulty: 'Intermediate'
    },
    {
      id: 7,
      question: 'How do I update device location on the map?',
      answer: 'Go to Devices page, click Edit on the device you want to update, and modify the Location and Zone fields. Alternatively, drag and drop the device marker directly on the map interface for precise positioning.',
      category: 'Configuration',
      difficulty: 'Beginner'
    },
    {
      id: 8,
      question: 'What should I do if tags are not appearing in real-time?',
      answer: 'First, verify that the MQTT connection is active (check the connection status in the header). Then ensure your MQTT broker is running and publishing to the correct topics. Check Settings → MQTT Settings to verify topic configuration. Also, check if any filters are applied that might be hiding tags.',
      category: 'Troubleshooting',
      difficulty: 'Advanced'
    }
  ];

  const troubleshootingSteps = [
    {
      id: 1,
      title: 'MQTT Connection Issues',
      icon: AlertCircle,
      severity: 'high',
      estimatedTime: '10 minutes',
      steps: [
        { step: 'Verify broker address and port are correct', icon: CheckCircle },
        { step: 'Check if username and password are required', icon: CheckCircle },
        { step: 'Ensure firewall allows connections to MQTT broker', icon: AlertCircle },
        { step: 'Try using WebSocket (WS/WSS) protocol instead of MQTT', icon: Zap },
        { step: 'Check broker logs for connection attempts', icon: Search }
      ]
    },
    {
      id: 2,
      title: 'No Tag Data Appearing',
      icon: Filter,
      severity: 'medium',
      estimatedTime: '15 minutes',
      steps: [
        { step: 'Verify RFID readers are online and connected', icon: CheckCircle },
        { step: 'Check MQTT topic configuration matches reader output', icon: AlertCircle },
        { step: 'Ensure readers are publishing to the correct topics', icon: Search },
        { step: 'Verify tag format matches expected EPC format', icon: CheckCircle },
        { step: 'Check for any errors in browser console', icon: AlertCircle }
      ]
    },
    {
      id: 3,
      title: 'Dashboard Performance Issues',
      icon: Zap,
      severity: 'low',
      estimatedTime: '5 minutes',
      steps: [
        { step: 'Reduce auto-refresh interval in settings', icon: CheckCircle },
        { step: 'Clear old tag data to improve query performance', icon: Download },
        { step: 'Limit the number of tags displayed per page', icon: Filter },
        { step: 'Disable unused features or filters', icon: CheckCircle },
        { step: 'Check browser memory usage and close other tabs', icon: AlertCircle }
      ]
    },
    {
      id: 4,
      title: 'Login & Authentication Problems',
      icon: AlertCircle,
      severity: 'high',
      estimatedTime: '5 minutes',
      steps: [
        { step: 'Verify username and password are correct', icon: CheckCircle },
        { step: 'Clear browser cache and cookies', icon: CheckCircle },
        { step: 'Try a different browser', icon: ExternalLink },
        { step: 'Contact administrator to reset password', icon: Mail },
        { step: 'Check if account has been disabled', icon: AlertCircle }
      ]
    }
  ];

  const handleFeedback = (faqId: number, helpful: boolean) => {
    if (feedbackSubmitted.includes(faqId)) return;
    
    setHelpfulCounts(prev => {
      const newCounts = { ...prev, [faqId]: (prev[faqId] || 0) + (helpful ? 1 : -1) };
      localStorage.setItem('helpfulCounts', JSON.stringify(newCounts));
      return newCounts;
    });
    
    setFeedbackSubmitted(prev => [...prev, faqId]);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('support@rfidtracker.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const filteredFaqs = searchQuery 
    ? faqs.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      <Header title="Help & Documentation" showSearch onSearch={setSearchQuery} />
      
      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* Search Results Banner */}
        {searchQuery && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-blue-200 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Found <span className="font-semibold text-blue-600">{filteredFaqs.length}</span> results for 
                  <span className="font-semibold text-gray-900"> "{searchQuery}"</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">Click on any result to see details</p>
              </div>
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Clear Search
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Interactive Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 p-4 shadow-sm sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="size-5" />
                Help Center
              </h3>
              
              <nav className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] ${
                        activeSection === section.id
                          ? `${section.bgColor} ${section.color} shadow-md`
                          : 'text-gray-700 hover:bg-gray-50 hover:shadow'
                      }`}
                    >
                      <Icon className="size-5" />
                      <span className="font-medium">{section.label}</span>
                      {activeSection === section.id && (
                        <div className="ml-auto size-2 rounded-full bg-current animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Help Center Stats</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{faqs.length}</p>
                    <p className="text-xs text-gray-600">Articles</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{Object.keys(helpfulCounts).length}</p>
                    <p className="text-xs text-gray-600">Helpful Votes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* User Guide - Interactive */}
            {activeSection === 'guide' && (
              <div className="section-content space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Interactive User Guide</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="size-4" />
                      <span>Complete time: ~15 minutes</span>
                    </div>
                  </div>

                  {/* Progress Tracker */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Progress</span>
                      <span className="text-sm text-gray-600">
                        {activeGuideStep + 1} of {guideSteps.length}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${((activeGuideStep + 1) / guideSteps.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Interactive Guide Steps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {guideSteps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                          <button
                            key={index}
                            onClick={() => setActiveGuideStep(index)}
                            className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                              activeGuideStep === index
                                ? 'border-blue-300 bg-blue-50 shadow-sm'
                                : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                activeGuideStep === index ? 'bg-blue-100' : 'bg-gray-100'
                              }`}>
                                <Icon className={`size-5 ${
                                  activeGuideStep === index ? 'text-blue-600' : 'text-gray-600'
                                }`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                    {step.duration}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">
                                  {step.steps.length} steps
                                </p>
                              </div>
                              {index <= activeGuideStep && (
                                <CheckCircle className="size-5 text-green-500 ml-2" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Step Details */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900">
                          {guideSteps[activeGuideStep].title}
                        </h3>
                        <button
                          onClick={() => setVideoPlaying(!videoPlaying)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {videoPlaying ? (
                            <>
                              <Pause className="size-4" />
                              Pause Demo
                            </>
                          ) : (
                            <>
                              <Play className="size-4" />
                              Watch Demo
                            </>
                          )}
                        </button>
                      </div>

                      {/* Video Demo Placeholder */}
                      <div className="mb-6 relative">
                        <div className={`aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden transition-all duration-300 ${
                          videoPlaying ? 'ring-2 ring-blue-500' : ''
                        }`}>
                          <div className="absolute inset-0 flex items-center justify-center">
                            {videoPlaying ? (
                              <div className="text-center">
                                <div className="size-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                                  <Pause className="size-8 text-white" />
                                </div>
                                <p className="text-white font-medium">Demo Playing</p>
                              </div>
                            ) : (
                              <button
                                onClick={() => setVideoPlaying(true)}
                                className="size-20 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                              >
                                <Play className="size-10 text-white ml-1" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Step List */}
                      <div className="space-y-3">
                        {guideSteps[activeGuideStep].steps.map((step, stepIndex) => (
                          <div
                            key={stepIndex}
                            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex-shrink-0 size-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                              {stepIndex + 1}
                            </div>
                            <p className="text-gray-700">{step}</p>
                          </div>
                        ))}
                      </div>

                      {/* Navigation */}
                      <div className="flex justify-between mt-6 pt-6 border-t border-gray-200">
                        <button
                          onClick={() => setActiveGuideStep(Math.max(0, activeGuideStep - 1))}
                          disabled={activeGuideStep === 0}
                          className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ← Previous
                        </button>
                        <button
                          onClick={() => setActiveGuideStep(Math.min(guideSteps.length - 1, activeGuideStep + 1))}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {activeGuideStep === guideSteps.length - 1 ? 'Complete' : 'Next Step →'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ - Interactive */}
            {activeSection === 'faq' && (
              <div className="section-content space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
                      <p className="text-gray-600 mt-2">Browse common questions or search for specific topics</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {faqs.length} Questions
                      </div>
                    </div>
                  </div>

                  {/* FAQ Categories */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {['All', 'Setup', 'Troubleshooting', 'Technical', 'Configuration'].map((cat) => (
                      <button
                        key={cat}
                        className="px-4 py-2 rounded-full border border-gray-300 hover:border-blue-300 hover:bg-blue-50 text-sm transition-colors"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* FAQ List with Search Highlight */}
                  <div className="space-y-4">
                    {filteredFaqs.map((faq, index) => (
                      <div
                        key={faq.id}
                        className={`border rounded-xl transition-all duration-300 ${
                          expandedFaq === index
                            ? 'border-blue-300 bg-blue-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow'
                        }`}
                      >
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                          className="w-full flex items-center justify-between p-5 text-left"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {faq.category}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                faq.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                                faq.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {faq.difficulty}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {searchQuery ? (
                                <span dangerouslySetInnerHTML={{
                                  __html: faq.question.replace(
                                    new RegExp(searchQuery, 'gi'),
                                    match => `<span class="bg-yellow-200 px-1">${match}</span>`
                                  )
                                }} />
                              ) : faq.question}
                            </h3>
                          </div>
                          {expandedFaq === index ? (
                            <ChevronDown className="size-5 text-gray-500 ml-4 animate-rotate-down" />
                          ) : (
                            <ChevronRight className="size-5 text-gray-400 ml-4" />
                          )}
                        </button>
                        
                        {expandedFaq === index && (
                          <div className="px-5 pb-5 animate-slide-down">
                            <div className="pt-4 border-t border-gray-200">
                              <p className="text-gray-700 mb-6">
                                {searchQuery ? (
                                  <span dangerouslySetInnerHTML={{
                                    __html: faq.answer.replace(
                                      new RegExp(searchQuery, 'gi'),
                                      match => `<span class="bg-yellow-200 px-1">${match}</span>`
                                    )
                                  }} />
                                ) : faq.answer}
                              </p>
                              
                              {/* Feedback Section */}
                              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-4">
                                  <span className="text-sm text-gray-600">Was this helpful?</span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleFeedback(faq.id, true)}
                                      disabled={feedbackSubmitted.includes(faq.id)}
                                      className={`p-2 rounded-lg transition-colors ${
                                        feedbackSubmitted.includes(faq.id) && helpfulCounts[faq.id] > 0
                                          ? 'bg-green-100 text-green-600'
                                          : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600'
                                      }`}
                                    >
                                      <ThumbsUp className="size-5" />
                                    </button>
                                    <button
                                      onClick={() => handleFeedback(faq.id, false)}
                                      disabled={feedbackSubmitted.includes(faq.id)}
                                      className={`p-2 rounded-lg transition-colors ${
                                        feedbackSubmitted.includes(faq.id) && helpfulCounts[faq.id] < 0
                                          ? 'bg-red-100 text-red-600'
                                          : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600'
                                      }`}
                                    >
                                      <ThumbsDown className="size-5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-500">
                                  {helpfulCounts[faq.id] || 0} people found this helpful
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Troubleshooting - Interactive */}
            {activeSection === 'troubleshooting' && (
              <div className="section-content space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Interactive Troubleshooting Guide</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {troubleshootingSteps.map((issue) => {
                      const Icon = issue.icon;
                      return (
                        <div
                          key={issue.id}
                          className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                issue.severity === 'high' ? 'bg-red-100' :
                                issue.severity === 'medium' ? 'bg-orange-100' : 'bg-yellow-100'
                              }`}>
                                <Icon className={`size-5 ${
                                  issue.severity === 'high' ? 'text-red-600' :
                                  issue.severity === 'medium' ? 'text-orange-600' : 'text-yellow-600'
                                }`} />
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                                    issue.severity === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)} Priority
                                  </span>
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {issue.estimatedTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {issue.steps.map((step, stepIndex) => (
                              <div
                                key={stepIndex}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-white transition-colors"
                              >
                                <div className="flex-shrink-0">
                                  <step.icon className="size-4 text-gray-500" />
                                </div>
                                <span className="text-sm text-gray-700">{step.step}</span>
                              </div>
                            ))}
                          </div>
                          
                          <button className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                            Mark as Resolved
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Contact Support - Interactive */}
            {activeSection === 'contact' && (
              <div className="section-content space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Get Help & Support</h2>
                  <p className="text-gray-600 mb-8">Our team is ready to assist you with any questions or issues</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl">
                      <Mail className="size-10 text-blue-600 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Support</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Get detailed help via email. Average response time: 2 hours
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-medium">support@rfidtracker.com</span>
                        <button
                          onClick={copyEmail}
                          className="p-1 hover:bg-blue-200 rounded transition-colors"
                          title="Copy email"
                        >
                          <Copy className="size-4 text-blue-500" />
                        </button>
                      </div>
                      {copiedEmail && (
                        <div className="mt-2 text-sm text-green-600 animate-fade-in">
                          ✓ Copied to clipboard!
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl">
                      <MessageSquare className="size-10 text-green-600 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Live Chat</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Chat with our support agents in real-time
                      </p>
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        Start Chat
                      </button>
                    </div>
                    
                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl">
                      <Book className="size-10 text-purple-600 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Documentation</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Browse our comprehensive guides and API docs
                      </p>
                      <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                        View Docs
                      </button>
                    </div>
                  </div>
                  
                  {/* Contact Form */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Send us a Message</h3>
                    <form className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Your Name
                          </label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address
                          </label>
                          <input
                            type="email"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Issue Type
                        </label>
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow">
                          <option>Select an issue type</option>
                          <option>Technical Support</option>
                          <option>Billing & Account</option>
                          <option>Feature Request</option>
                          <option>Bug Report</option>
                          <option>General Inquiry</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Message
                        </label>
                        <textarea
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                          rows={5}
                          placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, and what you've tried so far..."
                        />
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <button
                          type="submit"
                          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
                        >
                          Send Message
                        </button>
                        <button
                          type="button"
                          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Attach Files
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, HelpCircle, Mail, Search, ChevronDown, ChevronRight, 
  MessageSquare, Zap, AlertCircle, CheckCircle, FileText,
  Copy, ExternalLink, Download, X, Upload, Send, FolderOpen,
  ChevronUp, ChevronLeft, Home, Settings
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { apiService } from '../services/apiService'; // Import the API service

export const HelpPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('guide');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGuideStep, setActiveGuideStep] = useState(0);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showDocs, setShowDocs] = useState(false);
  const [supportForm, setSupportForm] = useState({
    name: '',
    email: '',
    issueType: '',
    message: '',
    attachments: [] as File[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTroubleshooting, setActiveTroubleshooting] = useState<number | null>(null);
  const [activeFaqCategory, setActiveFaqCategory] = useState<string>('All');

  const sectionRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation sections
  const sections = [
    { 
      id: 'guide', 
      label: 'User Guide', 
      icon: Book, 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50',
      description: 'Interactive tutorials and guides' 
    },
    { 
      id: 'faq', 
      label: 'FAQ', 
      icon: HelpCircle, 
      color: 'text-green-600', 
      bgColor: 'bg-green-50',
      description: 'Frequently asked questions and answers' 
    },
    { 
      id: 'troubleshooting', 
      label: 'Troubleshooting', 
      icon: Zap, 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50',
      description: 'Diagnose and fix common issues' 
    },
    { 
      id: 'contact', 
      label: 'Contact Support', 
      icon: Mail, 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-50',
      description: 'Get help from our support team' 
    },
  ];

  // Simple Interactive Guide
  const guideSteps = [
    {
      title: 'Quick Setup',
      icon: Settings,
      steps: [
        'Login with your credentials',
        'Navigate to Settings → MQTT Configuration',
        'Enter your broker details',
        'Test and save connection'
      ],
      interactive: true
    },
    {
      title: 'Dashboard Tour',
      icon: Home,
      steps: [
        'View real-time tag activity',
        'Monitor statistics cards',
        'Analyze activity patterns',
        'Check device distribution'
      ],
      interactive: true
    },
    {
      title: 'Tag Management',
      icon: Book,
      steps: [
        'Search and filter tags',
        'Export data in multiple formats',
        'Set up data archiving',
        'Monitor performance metrics'
      ],
      interactive: true
    },
    {
      title: 'Device Configuration',
      icon: Settings,
      steps: [
        'Add RFID readers',
        'Configure reader settings',
        'Set up location mapping',
        'Monitor device health'
      ],
      interactive: true
    }
  ];

  // FAQ Data with categories
  const faqs = [
    {
      id: 1,
      question: 'How do I connect to the MQTT broker?',
      answer: 'Go to Settings → MQTT Settings and enter your broker details including address, port, and credentials. Click "Save Changes".',
      category: 'Setup'
    },
    {
      id: 2,
      question: 'Why are some devices showing as offline?',
      answer: 'Devices show offline if they haven\'t sent a heartbeat in 5 minutes. Check the device\'s network connection.',
      category: 'Troubleshooting'
    },
    {
      id: 3,
      question: 'How do I export tag data?',
      answer: 'Navigate to Tag Data page, apply filters if needed, then click "Export" button in top right.',
      category: 'Data Management'
    },
    {
      id: 4,
      question: 'What does RSSI mean and why is it important?',
      answer: 'RSSI (Received Signal Strength Indicator) measures the power level of the RFID signal in dBm. Higher values indicate stronger signals.',
      category: 'Technical'
    },
    {
      id: 5,
      question: 'How long is tag data retained?',
      answer: 'Default is 30 days. Configurable in Settings → System Config.',
      category: 'Configuration'
    },
    {
      id: 6,
      question: 'Can I add multiple users with different permissions?',
      answer: 'Yes, administrators can add and manage users from Settings → User Management.',
      category: 'Administration'
    },
    {
      id: 7,
      question: 'How do I update device location on the map?',
      answer: 'Go to Devices page, click Edit on the device you want to update, and modify the Location and Zone fields.',
      category: 'Configuration'
    },
    {
      id: 8,
      question: 'What should I do if tags are not appearing in real-time?',
      answer: 'First, verify that the MQTT connection is active (check the connection status in the header).',
      category: 'Troubleshooting'
    },
    {
      id: 9,
      question: 'How do I configure automatic alerts?',
      answer: 'Go to Settings → Alerts Configuration to set up notifications for specific events.',
      category: 'Setup'
    },
    {
      id: 10,
      question: 'What is the difference between EPC and TID?',
      answer: 'EPC (Electronic Product Code) is a unique identifier for the tag, while TID (Tag ID) is the manufacturer\'s serial number.',
      category: 'Technical'
    }
  ];

  // FAQ Categories
  const faqCategories = ['All', 'Setup', 'Troubleshooting', 'Technical', 'Configuration', 'Data Management', 'Administration'];

  // Interactive Troubleshooting Guide
  const troubleshootingSteps = [
    {
      id: 1,
      title: 'MQTT Connection Issues',
      icon: AlertCircle,
      severity: 'high',
      steps: [
        'Verify broker address and port',
        'Check username and password',
        'Ensure firewall allows connections',
        'Try WebSocket protocol',
        'Check broker logs'
      ]
    },
    {
      id: 2,
      title: 'No Tag Data Appearing',
      icon: AlertCircle,
      severity: 'medium',
      steps: [
        'Verify RFID readers are online',
        'Check MQTT topic configuration',
        'Ensure readers publish to correct topics',
        'Verify tag format matches EPC format',
        'Check browser console for errors'
      ]
    },
    {
      id: 3,
      title: 'Dashboard Performance',
      icon: Settings,
      severity: 'low',
      steps: [
        'Reduce auto-refresh interval',
        'Clear old tag data',
        'Limit tags displayed per page',
        'Disable unused features',
        'Check browser memory usage'
      ]
    },
    {
      id: 4,
      title: 'Login Problems',
      icon: AlertCircle,
      severity: 'high',
      steps: [
        'Verify username and password',
        'Clear browser cache and cookies',
        'Try a different browser',
        'Contact administrator'
      ]
    }
  ];

  // Load documentation
  useEffect(() => {
    if (showDocs) {
      fetchDocuments();
    }
  }, [showDocs]);

  const fetchDocuments = async () => {
    try {
      // Use apiService for fetching documents
      const response = await apiService.getHelpDocumentation();
      
      if (response.success) {
        setDocuments(response.data || []);
      } else {
        toast.error(response.error || 'Failed to load documentation');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documentation');
    }
  };

  const handleDownloadTroubleshootingGuide = async () => {
    try {
      // Use apiService for downloading guide
      const response = await apiService.getTroubleshootingGuide();
      
      if (response.success) {
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'troubleshooting-guide.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast.success('Troubleshooting guide downloaded');
      } else {
        toast.error(response.error || 'Failed to download guide');
      }
    } catch (error) {
      console.error('Error downloading guide:', error);
      toast.error('Failed to download guide');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSupportForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...files]
      }));
      toast.info(`${files.length} file(s) added`);
    }
  };

  const removeAttachment = (index: number) => {
    setSupportForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prepare FormData for multipart/form-data submission
      const formData = new FormData();
      formData.append('name', supportForm.name);
      formData.append('email', supportForm.email);
      formData.append('issueType', supportForm.issueType);
      formData.append('message', supportForm.message);
      
      // Append all attachments
      supportForm.attachments.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await apiService.sendSupportEmail(formData);

      if (response.success) {
        toast.success('Support request sent successfully!');
        setSupportForm({
          name: '',
          email: '',
          issueType: '',
          message: '',
          attachments: []
        });
      } else {
      // Check for token-related errors
      if (response.error && (response.error.includes('token') || response.error.includes('auth') || response.error.includes('expired'))) {
        toast.error('Session expired. Please log in again.');
        // Clear all possible token keys
        localStorage.removeItem('rfid_auth_token');
        localStorage.removeItem('token');
        // Redirect to login page
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        toast.error(response.error || 'Failed to send support request');
      }
    }
  } catch (error) {
    console.error('Error submitting support request:', error);
    toast.error('Network error. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};

  const copyEmail = () => {
    navigator.clipboard.writeText('sales@clbgroups.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    toast.info('Email copied to clipboard');
  };

  // Filter FAQs based on search query AND category
  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = searchQuery ? 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    
    const matchesCategory = activeFaqCategory === 'All' || faq.category === activeFaqCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Animate section transitions
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.section-content');
    sections.forEach(section => {
      section.classList.remove('animate-slide-in');
      void section.offsetWidth; // Trigger reflow
      section.classList.add('animate-slide-in');
    });
  }, [activeSection]);

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      <ToastContainer position="top-right" autoClose={3000} />
      <Header title="Help & Documentation" showSearch onSearch={setSearchQuery} />
      
      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* Search Results Banner */}
        {searchQuery && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Found <span className="font-semibold text-blue-600">{filteredFaqs.length}</span> results
                </p>
              </div>
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                Clear Search
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Interactive Sidebar Navigation - Restored to original style */}
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
                      className={`w-full flex items-start gap-3 px-4 py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] ${
                        activeSection === section.id
                          ? `${section.bgColor} ${section.color} shadow-md border-l-4 border-l-current`
                          : 'text-gray-700 hover:bg-gray-50 hover:shadow border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        activeSection === section.id
                          ? `${section.bgColor.replace('50', '100')}`
                          : 'bg-gray-100'
                      }`}>
                        <Icon className={`size-5 ${
                          activeSection === section.id
                            ? section.color
                            : 'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{section.label}</div>
                        <div className="text-sm text-gray-600 mt-0.5">{section.description}</div>
                      </div>
                      {activeSection === section.id && (
                        <div className="mt-2 size-2 rounded-full bg-current animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Interactive User Guide */}
            {activeSection === 'guide' && (
              <div className="section-content space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Interactive User Guide</h2>
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
                      <h3 className="text-xl font-bold text-gray-900 mb-6">
                        {guideSteps[activeGuideStep].title}
                      </h3>

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

            {/* FAQ Section */}
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
                        {filteredFaqs.length} Questions
                      </div>
                    </div>
                  </div>

                  {/* FAQ Categories */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {faqCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setActiveFaqCategory(category)}
                        className={`px-4 py-2 rounded-full border text-sm transition-all duration-200 font-medium ${
                          activeFaqCategory === category
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'border-gray-300 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  {/* FAQ List */}
                  <div className="space-y-4">
                    {filteredFaqs.length > 0 ? (
                      filteredFaqs.map((faq, index) => (
                        <div
                          key={faq.id}
                          className={`border rounded-xl ${
                            expandedFaq === index ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:shadow'
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
                              </div>
                              <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                            </div>
                            {expandedFaq === index ? (
                              <ChevronUp className="size-5 text-gray-500" />
                            ) : (
                              <ChevronDown className="size-5 text-gray-400" />
                            )}
                          </button>
                          
                          {expandedFaq === index && (
                            <div className="px-5 pb-5 border-t border-gray-200 pt-4">
                              <p className="text-gray-700">{faq.answer}</p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <HelpCircle className="size-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No questions found</h3>
                        <p className="text-gray-600">
                          {searchQuery 
                            ? `No questions found for "${searchQuery}" in ${activeFaqCategory} category`
                            : `No questions found in ${activeFaqCategory} category`
                          }
                        </p>
                        <button
                          onClick={() => {
                            setActiveFaqCategory('All');
                            setSearchQuery('');
                          }}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Show All Questions
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Troubleshooting Guide */}
            {activeSection === 'troubleshooting' && (
              <div className="section-content space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Interactive Troubleshooting Guide</h2>
                    <button
                      onClick={handleDownloadTroubleshootingGuide}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="size-4" />
                      Download Full Guide
                    </button>
                  </div>
                  
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
                                <div className="flex-shrink-0 size-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                                  {stepIndex + 1}
                                </div>
                                <span className="text-sm text-gray-700">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Contact Support */}
            {activeSection === 'contact' && (
              <div className="section-content space-y-6">
                {showDocs ? (
                  // Documentation Browser
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Documentation</h2>
                        <p className="text-gray-600">Browse available documentation</p>
                      </div>
                      <button
                        onClick={() => setShowDocs(false)}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
                      >
                        <ChevronLeft className="size-4" />
                        Back to Support
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                              <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                              <div className="flex items-center gap-3 mt-3">
                                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                  {doc.category}
                                </span>
                                <span className="text-xs text-gray-500">{doc.size} • {doc.format}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => window.open(doc.url, '_blank')}
                              className="p-2 text-blue-600 hover:text-blue-700"
                              title="Open document"
                            >
                              <ExternalLink className="size-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Quick Help Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                        <Mail className="size-10 text-blue-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Support</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Get detailed help via email
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 font-medium">sales@clbgroups.com</span>
                          <button
                            onClick={copyEmail}
                            className="p-1 hover:bg-blue-200 rounded"
                            title="Copy email"
                          >
                            <Copy className="size-4 text-blue-500" />
                          </button>
                        </div>
                        {copiedEmail && (
                          <div className="mt-2 text-sm text-green-600">
                            ✓ Copied to clipboard
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                        <MessageSquare className="size-10 text-green-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Live Chat</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Chat with our support team
                        </p>
                        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                          Start Chat
                        </button>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
                        <FileText className="size-10 text-purple-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Documentation</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Browse guides and API docs
                        </p>
                        <button
                          onClick={() => setShowDocs(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          <FolderOpen className="size-4" />
                          Browse Documents
                        </button>
                      </div>
                    </div>

                    {/* Support Form */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-gray-900 mb-6">Send us a Message</h3>
                      <form onSubmit={handleSupportSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Your Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={supportForm.name}
                              onChange={(e) => setSupportForm({...supportForm, name: e.target.value})}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                              placeholder="John Doe"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Email Address *
                            </label>
                            <input
                              type="email"
                              required
                              value={supportForm.email}
                              onChange={(e) => setSupportForm({...supportForm, email: e.target.value})}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                              placeholder="john@example.com"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Issue Type
                          </label>
                          <select
                            value={supportForm.issueType}
                            onChange={(e) => setSupportForm({...supportForm, issueType: e.target.value})}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                          >
                            <option value="">Select issue type</option>
                            <option value="Technical">Technical Support</option>
                            <option value="Billing">Billing & Account</option>
                            <option value="Feature">Feature Request</option>
                            <option value="Bug">Bug Report</option>
                            <option value="General">General Inquiry</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Message *
                          </label>
                          <textarea
                            required
                            value={supportForm.message}
                            onChange={(e) => setSupportForm({...supportForm, message: e.target.value})}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                            rows={5}
                            placeholder="Describe your issue..."
                          />
                        </div>

                        {/* File Attachments */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Attachments
                          </label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              multiple
                              className="hidden"
                            />
                            <Upload className="size-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm text-gray-600 mb-2">
                              Drop files here or click to upload
                            </p>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Select Files
                            </button>
                            <p className="text-xs text-gray-500 mt-2">
                              Max 10MB per file • PDF, JPG, PNG, TXT
                            </p>
                          </div>

                          {/* File List */}
                          {supportForm.attachments.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {supportForm.attachments.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <FileText className="size-5 text-gray-500" />
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                      <p className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(2)} KB
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(index)}
                                    className="p-1 hover:bg-gray-200 rounded"
                                  >
                                    <X className="size-4 text-gray-500" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="size-4" />
                            {isSubmitting ? 'Sending...' : 'Send Message'}
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Add Files
                          </button>
                        </div>
                      </form>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
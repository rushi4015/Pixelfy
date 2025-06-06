import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Linking, TouchableOpacity, Alert, Pressable } from 'react-native';
import { Feather, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

const HelpScreen = () => {
  const router = useRouter();
  const [showReportOptions, setShowReportOptions] = useState(false);
  const reportPanelY = useSharedValue(500);

  const handleSupportEmail = () => {
    const email = 'pixelfyhelp@gmail.com';
    const subject = encodeURIComponent('Support Request');
    const body = encodeURIComponent(
      'Hello Pixelfy Support Team,\n\n' +
      'I need assistance with:\n\n' +
      '[Please describe your issue here]\n\n' +
      'Additional Information:\n' +
      '- Device: [Your device model]\n' +
      '- OS Version: [Your OS version]\n' +
      '- App Version: 1.0.0\n\n' +
      'Thank you!'
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  useEffect(() => {
    if (showReportOptions) {
      reportPanelY.value = withSpring(0, { damping: 15 });
    } else {
      reportPanelY.value = withSpring(500, { damping: 15 });
    }
  }, [showReportOptions]);

  const handleReportIssue = () => {
    setShowReportOptions(true);
  };

  const handleEmailReport = () => {
    setShowReportOptions(false);
    const email = 'pixelfyhelp@gmail.com';
    const subject = encodeURIComponent('Issue Report');
    const body = encodeURIComponent(
      'Hello Pixelfy Team,\n\n' +
      'I would like to report the following issue:\n\n' +
      '[Please describe the issue here]\n\n' +
      'Additional Information:\n' +
      '- Device: [Your device model]\n' +
      '- OS Version: [Your OS version]\n' +
      '- App Version: 1.0.0\n\n' +
      'Thank you!'
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  const handleGitHubReport = () => {
    setShowReportOptions(false);
    Linking.openURL('https://github.com/TaskmasterRishi/Pixelfy/issues');
  };

  const supportOptions = [
    {
      icon: 'help-circle',
      title: 'FAQs & Guides',
      description: 'Find answers to common questions',
      action: () => router.push('/faq'),
      color: '#3b82f6'
    },
    {
      icon: 'mail',
      title: 'Contact Support',
      description: 'Get help from our support team',
      action: handleSupportEmail,
      color: '#10b981'
    },
    {
      icon: 'alert-circle',
      title: 'Report Issue',
      description: 'Report bugs or technical problems',
      action: handleReportIssue,
      color: '#ef4444'
    },
    {
      icon: 'shield',
      title: 'Safety Center',
      description: 'Learn about safety features',
      action: () => router.push('/safety'),
      color: '#8b5cf6'
    }
  ];

  return (
    <>
      <ScrollView className="flex-1 bg-white pt-">
        {/* Header */}
        <View className="bg-blue-50 p-6 pt-20">
          <Text className="text-3xl font-bold mb-2">Help Center</Text>
          <Text className="text-base text-gray-600">
            We're here to help! Find answers, get support, and learn how to use Pixelfy.
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="p-6">
          <Text className="text-xl font-semibold mb-4">Quick Help</Text>
          <View className="flex-row flex-wrap -mx-2">
            {supportOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                className="w-1/2 px-2 mb-4"
                onPress={option.action}
              >
                <View className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <View className="w-10 h-10 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: `${option.color}10` }}
                  >
                    <Feather name={option.icon} size={20} color={option.color} />
                  </View>
                  <Text className="text-base font-semibold mb-1">{option.title}</Text>
                  <Text className="text-sm text-gray-600">{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Info */}
        <View className="p-6 border-t border-gray-100">
          <Text className="text-sm text-gray-500 text-center">
            Pixelfy Version 1.0.0 • © 2025 Pixelfy, Inc.
          </Text>
        </View>
      </ScrollView>

      {/* Report Options Modal */}
      <View className="absolute inset-0" pointerEvents={showReportOptions ? 'auto' : 'none'}>
        <Pressable 
          className="flex-1"
          onPress={() => setShowReportOptions(false)}
          style={{ 
            opacity: showReportOptions ? 1 : 0,
            backgroundColor: showReportOptions ? 'rgba(0,0,0,0.5)' : 'transparent'
          }}
        />
        <Animated.View 
          style={{ 
            transform: [{ translateY: reportPanelY }],
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0
          }}
        >
          <View className="w-12 h-1 bg-gray-300 rounded-full mx-auto my-3" />
          
          <TouchableOpacity 
            onPress={handleEmailReport}
            className="flex-row items-center px-6 py-4 border-b border-gray-200"
          >
            <Feather name="mail" size={24} color="#3b82f6" />
            <Text className="ml-4">Report via Email</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleGitHubReport}
            className="flex-row items-center px-6 py-4 border-b border-gray-200"
          >
            <Feather name="github" size={24} color="#000" />
            <Text className="ml-4">Report via GitHub</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setShowReportOptions(false)}
            className="px-6 py-4 mb-6"
          >
            <Text className="text-center text-gray-500">Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
};

export default HelpScreen; 
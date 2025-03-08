import { View, Text, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Channel as ChannelType } from 'stream-chat';
import { useChatContext, Channel, MessageList, MessageInput } from 'stream-chat-expo';

const ChannelScreen = () => {
  const [channel, setChannel] = useState<ChannelType | null>(null);
  const { client } = useChatContext();
  const { id } = useLocalSearchParams();

  useEffect(() => {
    const fetchChannel = async () => {
      try {
        // Get the channel directly using the ID
        const channel = client.channel('messaging', 'public');
        await channel.watch();
        setChannel(channel);
        console.log('Channel loaded:', channel.id);
      } catch (error) {
        console.error('Error loading channel:', error);
      }
    };

    fetchChannel();
  }, [id]);

  if (!channel) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading channel...</Text>
      </View>
    );
  }

  return (
    <Channel channel={channel}>
      <View style={{ flex: 1 }}>
        <MessageList />
        <MessageInput />
      </View>
    </Channel>
  );
};

export default ChannelScreen;
import { View } from 'react-native';
import { ChannelList,Channel, MessageList, MessageInput } from 'stream-chat-expo';
import { Channel as ChannelType } from 'stream-chat';
import { useState } from 'react';
import { useRouter } from 'expo-router';

export default function ChatScreen() {
    // const [channel, setChannel] = useState<ChannelType>();

const router =useRouter();

// if(channel){
//    return (
//       <Channel channel={channel}>
//          <MessageList/>
//          <MessageInput/>
//       </Channel>
//    )
// }

    // const onSelect = (channel: ChannelType) => {
    //     setChannel(channel);
    //     // console.log('Selected channel:', channel);
    // };

    return (
        <ChannelList onSelect={(channel)=>router.push('/chat/channel/${channel.id}')}/>
    );
} 




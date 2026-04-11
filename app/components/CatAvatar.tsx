import { View, Image, Text } from 'react-native';
import { useState } from 'react';

interface CatAvatarProps {
  photoUrl: string | null | undefined;
  name: string;
  size: number;
  grayscale?: boolean;
}

export default function CatAvatar({ photoUrl, size, grayscale }: CatAvatarProps) {
  const [hasError, setHasError] = useState(false);

  if (photoUrl && !hasError) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: grayscale ? 0.6 : 1,
        }}
        resizeMode="cover"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: grayscale ? 0.6 : 1,
      }}
    >
      <Text style={{ fontSize: size * 0.45 }}>{'\uD83D\uDC31'}</Text>
    </View>
  );
}

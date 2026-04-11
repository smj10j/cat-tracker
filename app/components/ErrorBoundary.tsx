import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ color: '#6b5f85', fontSize: 14, textAlign: 'center' }}>
            Chart unavailable — showing data table instead
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

import React, { useState } from 'react';
import { View, TextInput, TextInputProps, StyleSheet, TouchableOpacity } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from './Typography';
import { Eye, EyeOff } from 'lucide-react-native'; // Requires lucide-react-native
import { useAppTheme } from '@/src/theme/appTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  secureTextEntry,
  leftIcon,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const appTheme = useAppTheme();

  return (
    <View style={styles.container}>
      {label && (
        <Typography variant="bodySmall" style={styles.label}>
          {label}
        </Typography>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: appTheme.input,
            borderColor: appTheme.border,
          },
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, style]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={appTheme.disabled}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIcon}
          >
            {isPasswordVisible ? (
              <EyeOff color={appTheme.muted} size={20} />
            ) : (
              <Eye color={appTheme.muted} size={20} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Typography variant="caption" color={Theme.colors.error} style={styles.errorText}>
          {error}
        </Typography>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.md,
  },
  label: {
    marginBottom: Theme.spacing.xs,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    height: 48,
    paddingHorizontal: Theme.spacing.md,
  },
  inputFocused: {
    borderColor: Theme.colors.primary,
  },
  inputError: {
    borderColor: Theme.colors.error,
  },
  input: {
    flex: 1,
    height: '100%',
    color: Theme.colors.text,
    fontSize: Theme.typography.body.fontSize,
  },
  leftIcon: {
    marginRight: Theme.spacing.sm,
  },
  rightIcon: {
    marginLeft: Theme.spacing.sm,
  },
  errorText: {
    marginTop: Theme.spacing.xs,
  },
});

import { ThemeConfig } from 'antd';
import { solarized, lightColors, darkColors } from '../styles/theme';

export const lightTheme: ThemeConfig = {
  token: {
    // Primary colors - using Solarized palette
    colorPrimary: solarized.blue,
    colorSuccess: lightColors.success,
    colorWarning: solarized.yellow,
    colorError: solarized.red,
    colorInfo: solarized.cyan,

    // Background colors
    colorBgBase: lightColors.background,
    colorBgContainer: lightColors.background,
    colorBgElevated: lightColors.backgroundElevated,
    colorBgLayout: lightColors.backgroundPanel,

    // Text colors
    colorText: lightColors.text,
    colorTextSecondary: lightColors.textSecondary,
    colorTextTertiary: lightColors.textMuted,

    // Border colors
    colorBorder: lightColors.border,
    colorBorderSecondary: lightColors.backgroundAlt,

    // Border and layout
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusOuter: 4,

    // Typography
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

    // Spacing
    padding: 12,
    paddingLG: 16,
    paddingSM: 8,
    paddingXS: 6,

    // Component specific
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,

    // Box shadow
    boxShadowSecondary: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  },
  components: {
    Card: {
      borderRadius: 6,
      paddingLG: 12,
    },
    Collapse: {
      borderRadius: 6,
      headerBg: lightColors.backgroundPanel,
    },
    Button: {
      borderRadius: 6,
    },
    Input: {
      borderRadius: 6,
    },
    Select: {
      borderRadius: 6,
    },
    Form: {
      itemMarginBottom: 16,
      verticalLabelPadding: '0 0 4px',
    },
    Typography: {
      fontSize: 14,
    },
    Tag: {
      borderRadius: 4,
      fontSize: 11,
    },
    Badge: {
      fontSize: 11,
    },
  },
};

export const darkTheme: ThemeConfig = {
  token: {
    // Primary colors - using Solarized palette
    colorPrimary: solarized.blue,
    colorSuccess: solarized.green,
    colorWarning: solarized.yellow,
    colorError: solarized.red,
    colorInfo: solarized.cyan,

    // Background colors - using Solarized dark
    colorBgBase: darkColors.background,
    colorBgContainer: darkColors.backgroundAlt,
    colorBgElevated: darkColors.backgroundElevated,
    colorBgLayout: darkColors.background,

    // Text colors
    colorText: darkColors.text,
    colorTextSecondary: darkColors.textSecondary,
    colorTextTertiary: darkColors.textMuted,

    // Border colors
    colorBorder: darkColors.border,
    colorBorderSecondary: darkColors.borderHover,

    // Border and layout
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusOuter: 4,

    // Typography
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

    // Spacing
    padding: 12,
    paddingLG: 16,
    paddingSM: 8,
    paddingXS: 6,

    // Component specific
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,

    // Box shadow
    boxShadowSecondary: '0 4px 12px 0 rgba(0, 0, 0, 0.4)',
  },
  components: {
    Card: {
      borderRadius: 6,
      paddingLG: 12,
      colorBgContainer: darkColors.backgroundAlt,
    },
    Collapse: {
      borderRadius: 6,
      headerBg: darkColors.backgroundAlt,
      contentBg: darkColors.background,
    },
    Button: {
      borderRadius: 6,
    },
    Input: {
      borderRadius: 6,
      colorBgContainer: darkColors.backgroundAlt,
      colorBorder: darkColors.border,
    },
    Select: {
      borderRadius: 6,
      colorBgContainer: darkColors.backgroundAlt,
      colorBorder: darkColors.border,
    },
    Form: {
      itemMarginBottom: 16,
      verticalLabelPadding: '0 0 4px',
    },
    Typography: {
      fontSize: 14,
    },
    Tag: {
      borderRadius: 4,
      fontSize: 11,
    },
    Badge: {
      fontSize: 11,
    },
    Modal: {
      contentBg: darkColors.backgroundAlt,
      headerBg: darkColors.backgroundAlt,
    },
    Tooltip: {
      colorBgSpotlight: darkColors.backgroundElevated,
    },
  },
};

// Legacy export for backwards compatibility
export const antdTheme = lightTheme;

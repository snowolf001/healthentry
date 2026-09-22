import { darkTheme, lightTheme, themeForScheme } from '../src/ui/theme';

test('selects a genuinely dark palette only for the dark system scheme', () => {
  expect(themeForScheme('dark')).toBe(darkTheme);
  expect(themeForScheme('light')).toBe(lightTheme);
  expect(themeForScheme(null)).toBe(lightTheme);
  expect(darkTheme.dark).toBe(true);
  expect(darkTheme.background).not.toBe(lightTheme.background);
  expect(darkTheme.textPrimary).not.toBe(lightTheme.textPrimary);
});

test('both palettes expose the complete semantic token contract', () => {
  expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort());
  for (const theme of [lightTheme, darkTheme]) {
    expect(theme.background).toMatch(/^#/);
    expect(theme.surface).toMatch(/^#/);
    expect(theme.inputBackground).toMatch(/^#/);
    expect(theme.success).toMatch(/^#/);
    expect(theme.error).toMatch(/^#/);
  }
});

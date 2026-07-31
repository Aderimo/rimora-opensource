/**
 * Erişilebilirlik Yardımcı Fonksiyonları
 * WCAG 2.1 AA standartlarına uygun yardımcı fonksiyonlar
 */

/**
 * Bir elementin erişilebilir adını oluşturur
 */
export function getAccessibleName(
  label: string,
  description?: string
): { 'aria-label': string; 'aria-describedby'?: string } {
  const result: { 'aria-label': string; 'aria-describedby'?: string } = {
    'aria-label': label,
  }
  
  if (description) {
    const id = `desc-${Math.random().toString(36).substr(2, 9)}`
    result['aria-describedby'] = id
  }
  
  return result
}

/**
 * Loading state için ARIA attributes
 */
export function getLoadingAttributes(isLoading: boolean) {
  return {
    'aria-busy': isLoading,
    'aria-live': 'polite' as const,
  }
}

/**
 * Error state için ARIA attributes
 */
export function getErrorAttributes(error?: string) {
  if (!error) return {}
  
  return {
    'aria-invalid': true,
    'aria-errormessage': `error-${Math.random().toString(36).substr(2, 9)}`,
  }
}

/**
 * Modal/Dialog için ARIA attributes
 */
export function getDialogAttributes(
  isOpen: boolean,
  title: string,
  description?: string
) {
  return {
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': `dialog-title-${Math.random().toString(36).substr(2, 9)}`,
    'aria-describedby': description
      ? `dialog-desc-${Math.random().toString(36).substr(2, 9)}`
      : undefined,
    'aria-hidden': !isOpen,
  }
}

/**
 * Navigation için ARIA attributes
 */
export function getNavigationAttributes(label: string) {
  return {
    role: 'navigation' as const,
    'aria-label': label,
  }
}

/**
 * Search için ARIA attributes
 */
export function getSearchAttributes(label: string = 'Arama') {
  return {
    role: 'search' as const,
    'aria-label': label,
  }
}

/**
 * Button için ARIA attributes (disabled state)
 */
export function getButtonAttributes(
  label: string,
  isDisabled: boolean = false,
  isPressed?: boolean
) {
  const attrs: {
    'aria-label': string
    'aria-disabled'?: boolean
    'aria-pressed'?: boolean
  } = {
    'aria-label': label,
  }
  
  if (isDisabled) {
    attrs['aria-disabled'] = true
  }
  
  if (isPressed !== undefined) {
    attrs['aria-pressed'] = isPressed
  }
  
  return attrs
}

/**
 * List için ARIA attributes
 */
export function getListAttributes(
  label: string,
  itemCount?: number
) {
  return {
    role: 'list' as const,
    'aria-label': label,
    'aria-setsize': itemCount,
  }
}

/**
 * Tab için ARIA attributes
 */
export function getTabAttributes(
  isSelected: boolean,
  controls: string,
  index: number
) {
  return {
    role: 'tab' as const,
    'aria-selected': isSelected,
    'aria-controls': controls,
    tabIndex: isSelected ? 0 : -1,
    id: `tab-${index}`,
  }
}

/**
 * TabPanel için ARIA attributes
 */
export function getTabPanelAttributes(
  isHidden: boolean,
  labelledBy: string,
  index: number
) {
  return {
    role: 'tabpanel' as const,
    'aria-labelledby': labelledBy,
    'aria-hidden': isHidden,
    id: `tabpanel-${index}`,
    tabIndex: 0,
  }
}

/**
 * Alert için ARIA attributes
 */
export function getAlertAttributes(
  type: 'error' | 'warning' | 'info' | 'success' = 'info'
) {
  return {
    role: type === 'error' ? ('alert' as const) : ('status' as const),
    'aria-live': type === 'error' ? ('assertive' as const) : ('polite' as const),
    'aria-atomic': true,
  }
}

/**
 * Progress bar için ARIA attributes
 */
export function getProgressAttributes(
  value: number,
  max: number = 100,
  label?: string
) {
  return {
    role: 'progressbar' as const,
    'aria-valuenow': value,
    'aria-valuemin': 0,
    'aria-valuemax': max,
    'aria-label': label || `${Math.round((value / max) * 100)}% tamamlandı`,
  }
}

/**
 * Tooltip için ARIA attributes
 */
export function getTooltipAttributes(id: string) {
  return {
    role: 'tooltip' as const,
    id,
  }
}

/**
 * Combobox için ARIA attributes
 */
export function getComboboxAttributes(
  isExpanded: boolean,
  activeDescendant?: string
) {
  return {
    role: 'combobox' as const,
    'aria-expanded': isExpanded,
    'aria-haspopup': 'listbox' as const,
    'aria-activedescendant': activeDescendant,
    'aria-autocomplete': 'list' as const,
  }
}

/**
 * Skip link oluşturur (klavye navigasyonu için)
 */
export function createSkipLink(targetId: string, label: string = 'Ana içeriğe atla') {
  return {
    href: `#${targetId}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md',
    children: label,
  }
}

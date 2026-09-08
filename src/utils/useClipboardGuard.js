import { useEffect } from 'react';

/**
 * Global clipboard & anti-inspection protection hook.
 * Disables copy, cut, paste, right-click context menu, and drag-and-drop globally,
 * while cleanly permitting it on explicitly designated necessary areas:
 *  - Full unrestricted access for Game Master admin (user.role === 'admin' or .admin-dashboard-container)
 *  - Elements / ancestors with [data-allow-copy="true"] or .allow-copy (e.g. payload box)
 *  - Elements / ancestors with [data-allow-paste="true"] or .allow-paste (e.g. login/password fields, search inputs)
 *  - Elements / ancestors with [data-allow-context="true"] or .allow-context
 */
export function useClipboardGuard(user) {
 useEffect(() => {
 // If the active user is an admin, do not restrict any clipboard actions
 if (user?.role === 'admin') {
 return;
 }

 const isInsideAdmin = (el) => Boolean(el?.closest?.('.admin-dashboard-container, [data-allow-all="true"]'));

 const handleCopy = (e) => {
 const target = e.target;
 if (isInsideAdmin(target)) return;
 if (target?.closest?.('[data-allow-copy="true"], .allow-copy')) {
 return; // Allow explicitly marked copy targets
 }
 e.preventDefault();
 };

 const handleCut = (e) => {
 const target = e.target;
 if (isInsideAdmin(target)) return;
 if (target?.closest?.('[data-allow-copy="true"], .allow-copy, [data-allow-paste="true"], .allow-paste')) {
 return;
 }
 e.preventDefault();
 };

 const handlePaste = (e) => {
 const target = e.target;
 if (isInsideAdmin(target)) return;
 if (target?.closest?.('[data-allow-paste="true"], .allow-paste')) {
 return; // Allow explicitly marked paste inputs (e.g. login passkey)
 }
 e.preventDefault();
 };

 const handleContextMenu = (e) => {
 const target = e.target;
 if (isInsideAdmin(target)) return;
 if (target?.closest?.('[data-allow-context="true"], .allow-context')) {
 return;
 }
 e.preventDefault();
 };

 const handleDragStart = (e) => {
 const target = e.target;
 if (isInsideAdmin(target)) return;
 if (target?.closest?.('[data-allow-drag="true"], .allow-drag')) {
 return;
 }
 e.preventDefault();
 };

 document.addEventListener('copy', handleCopy);
 document.addEventListener('cut', handleCut);
 document.addEventListener('paste', handlePaste);
 document.addEventListener('contextmenu', handleContextMenu);
 document.addEventListener('dragstart', handleDragStart);

 return () => {
 document.removeEventListener('copy', handleCopy);
 document.removeEventListener('cut', handleCut);
 document.removeEventListener('paste', handlePaste);
 document.removeEventListener('contextmenu', handleContextMenu);
 document.removeEventListener('dragstart', handleDragStart);
 };
 }, [user?.role]);
}

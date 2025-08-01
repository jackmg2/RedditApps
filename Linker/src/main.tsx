import { Devvit } from '@devvit/public-api';
import { LinkerBoard } from './components/LinkerBoard.js';
import { useEditCellForm } from './forms/EditCellForm.js';
import { useEditPageForm } from './forms/EditPageForm.js';
import { useBackgroundImageForm } from './forms/BackgroundImageForm.js';
import { useLinkerData } from './hooks/useLinkerData.js';
import { useLinkerActions } from './hooks/useLinkerActions.js';
import './createPost.js';

Devvit.addCustomPostType({
  name: 'Community Links',
  height: 'tall',
  render: (context) => {
    // Data and actions - SINGLE SOURCE OF TRUTH
    const linkerDataHook = useLinkerData(context);
    const { linker, saveLinker, updateLinkerOptimistically } = linkerDataHook;
    const linkerActions = useLinkerActions({ 
      linker, 
      saveLinker, 
      updateLinkerOptimistically,
      context 
    });

    // Forms - Updated for simplified cell management
    const editCellForm = useEditCellForm({ 
      onUpdateCell: linkerActions.updateCell
    });

    const editPageForm = useEditPageForm({ 
      onUpdatePage: linkerActions.updatePage 
    });

    const backgroundImageForm = useBackgroundImageForm({
      currentBackgroundImage: linker?.pages[0]?.backgroundImage || '',
      onUpdateBackgroundImage: linkerActions.updateBackgroundImage
    });

    // Enhanced form handler for cell editing with variant management
    const handleShowEditCellForm = (cell: any, variantIndex: number = 0) => {
      // Ensure we have complete cell data for the form
      const cellWithDefaults = {
        id: cell.id,
        links: cell.links || [],
        weights: cell.weights || [],
        displayName: cell.displayName || '',
        rotationEnabled: cell.rotationEnabled || false,
        impressionCount: cell.impressionCount || 0,
        variantImpressions: cell.variantImpressions || {},
        currentEditingIndex: cell.currentEditingIndex || 0
      };
      
      // Ensure variant index is within bounds
      const safeVariantIndex = Math.max(0, Math.min(variantIndex, cellWithDefaults.links.length - 1));
      
      context.ui.showForm(editCellForm, { 
        e: JSON.stringify({
          cell: cellWithDefaults,
          variantIndex: safeVariantIndex
        })
      });
    };

    const handleShowEditPageForm = (pageData: any) => {
      context.ui.showForm(editPageForm, { e: JSON.stringify(pageData) });
    };

    const handleShowBackgroundImageForm = () => {
      context.ui.showForm(backgroundImageForm);
    };

    return (
      <LinkerBoard
        context={context}
        linkerDataHook={linkerDataHook}
        linkerActions={linkerActions}
        onShowEditCellForm={handleShowEditCellForm}
        onShowEditPageForm={handleShowEditPageForm}
        onShowBackgroundImageForm={handleShowBackgroundImageForm}
      />
    );
  }
});

Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;
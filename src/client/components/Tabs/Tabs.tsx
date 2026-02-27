import { ReactNode, useEffect, useState } from 'react';
import './Tabs.scss';

interface TabsProps {
  tabs?: string[];
  onTabChange?: (tab: string) => void;
  defaultActiveTab?: number;
  children?: ReactNode;
}

export default function Tabs({
  tabs = [],
  onTabChange = () => {},
  defaultActiveTab = 0,
  children,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState<number>(defaultActiveTab);
  const [hasManuallySelected, setHasManuallySelected] = useState<boolean>(false);

  useEffect(() => {
    if (!hasManuallySelected) {
      setActiveTab(defaultActiveTab);
    }
  }, [defaultActiveTab]);

  const showTab = (index: number) => {
    setHasManuallySelected(true);
    setActiveTab(index);
    onTabChange(tabs[index]);
  };

  return (
    <div className="Tabs">
      <div className="Tabs__buttons">
        { tabs.map((tab, index) => (
          <button
            key={ index }
            className={ `Tabs__tab ${activeTab === index ? 'Tabs__tab--active' : ''}` }
            type="button"
            title={ tab }
            onClick={ () => showTab(index) }>
            { tab }
          </button>
        )) }
      </div>
      <div className="Tabs__content">{ children }</div>
    </div>
  );
}

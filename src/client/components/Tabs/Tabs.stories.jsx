import Tabs from './Tabs';

export default {
  title: 'components/shared/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    tabs: {
      control: {
        type: 'array',
      },
    },
    defaultActiveTab: {
      control: {
        type: 'number',
      },
    },
  },
};

const tabsData = ['Tab 1', 'Tab 2', 'Tab 3'];

const Template = (args) => <Tabs { ...args } />;

export const Default = Template.bind({});
Default.args = {
  tabs: tabsData,
};

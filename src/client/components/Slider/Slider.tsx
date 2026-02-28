import PropTypes from 'prop-types';
import './Slider.scss';

const Slider = ({
  id = '',
  name = '',
  min = 0,
  max = 16,
  value = 0,
  onChange = (e: any) => {},
  className = '',
  isControlled = false,
  ...rest
}) => {
  return (
    <input
      className={'slider ' + className}
      type="range"
      id={id}
      name={name}
      min={min}
      max={max}
      {...(isControlled ? { value, onChange } : {})}
      {...rest}
    />
  );
};

Slider.propTypes = {
  id: PropTypes.string,
  name: PropTypes.string,
  min: PropTypes.number,
  max: PropTypes.number,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
};

export default Slider;

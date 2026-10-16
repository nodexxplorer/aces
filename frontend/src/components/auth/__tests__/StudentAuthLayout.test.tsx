import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StudentAuthLayout, { SLIDE_INTERVAL_MS, STUDENT_SLIDES } from '../StudentAuthLayout';
import type { Department } from '../../../api/departments';

const departments: Department[] = [
  { slug: 'uniuyo-ce', name: 'Dept of Computer Engineering', default: true, urlCode: 'co' },
  { slug: 'dept-ee', name: 'Dept of Electrical Engineering', urlCode: 'ee' },
];

function renderLayout(props: Partial<React.ComponentProps<typeof StudentAuthLayout>> = {}) {
  return render(
    <MemoryRouter>
      <StudentAuthLayout
        departments={departments}
        selected="uniuyo-ce"
        picked
        onSelect={vi.fn()}
        topRight={<span>Don&apos;t have an account?</span>}
        {...props}
      >
        <p>card content</p>
      </StudentAuthLayout>
    </MemoryRouter>,
  );
}

// The slides' own container is the parent of the dots group.
const slidesContainer = () => screen.getByRole('group', { name: 'Choose a slide' }).parentElement as HTMLElement;

describe('student sign-in layout: slides', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the first slide and one dot per slide', () => {
    renderLayout();
    expect(screen.getByText(STUDENT_SLIDES[0].title)).toBeInTheDocument();
    expect(screen.queryByText(STUDENT_SLIDES[1].title)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Show slide/ })).toHaveLength(STUDENT_SLIDES.length);
  });

  it('moves on to the next slide every five seconds', async () => {
    renderLayout();
    await act(() => vi.advanceTimersByTimeAsync(SLIDE_INTERVAL_MS));
    expect(screen.getByText(STUDENT_SLIDES[1].title)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(SLIDE_INTERVAL_MS));
    expect(screen.getByText(STUDENT_SLIDES[2].title)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(SLIDE_INTERVAL_MS));
    expect(screen.getByText(STUDENT_SLIDES[0].title)).toBeInTheDocument();
  });

  it('stays on a slide while the pointer is over it', async () => {
    renderLayout();
    fireEvent.mouseEnter(slidesContainer());
    await act(() => vi.advanceTimersByTimeAsync(SLIDE_INTERVAL_MS * 3));
    expect(screen.getByText(STUDENT_SLIDES[0].title)).toBeInTheDocument();

    fireEvent.mouseLeave(slidesContainer());
    await act(() => vi.advanceTimersByTimeAsync(SLIDE_INTERVAL_MS));
    expect(screen.getByText(STUDENT_SLIDES[1].title)).toBeInTheDocument();
  });

  it('switches to the slide whose dot is pressed', async () => {
    renderLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Show slide 3' }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText(STUDENT_SLIDES[2].title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show slide 3' })).toHaveAttribute('aria-current', 'true');
  });

  it('puts course form signing on the second slide only', () => {
    const withForms = STUDENT_SLIDES.filter((s) => /course forms/.test(s.text));
    expect(withForms).toHaveLength(1);
    expect(withForms[0].title).toBe('Your courses, in one place');
  });
});

describe('student sign-in layout: department picker', () => {
  it('marks the selected department and reports a choice', () => {
    const onSelect = vi.fn();
    renderLayout({ onSelect });
    expect(screen.getByRole('button', { name: 'Dept of Computer Engineering' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Dept of Electrical Engineering' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dept of Electrical Engineering' }));
    expect(onSelect).toHaveBeenCalledWith('dept-ee');
  });

  it('shows no logo top-left and presses no department until one is picked', () => {
    const { unmount } = renderLayout({ picked: false });
    // The picker's logos plus the Admin Park placeholder on the left; no top-left logo.
    expect(screen.getAllByRole('img')).toHaveLength(departments.length + 1);
    expect(screen.getByRole('button', { name: 'Dept of Computer Engineering' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Dept of Electrical Engineering' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    unmount();

    renderLayout({ picked: true });
    // The same, plus the top-left logo.
    expect(screen.getAllByRole('img')).toHaveLength(departments.length + 2);
    expect(screen.getByRole('button', { name: 'Dept of Computer Engineering' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('is hidden when there is only one department', () => {
    renderLayout({ departments: [departments[0]] });
    expect(screen.queryByRole('group', { name: 'Choose your department' })).not.toBeInTheDocument();
  });

  it('shows the link beside the picker and the card below', () => {
    renderLayout();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('card content')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StudentAuthLayout, { SLIDE_INTERVAL_MS, STUDENT_SLIDES } from '../StudentAuthLayout';

// The slide change waits on framer-motion's exit animation, which does not advance
// reliably under fake timers. These tests check the timing and the slide order, so the
// animation wrappers are replaced with plain elements.
vi.mock('framer-motion', () => {
  const Div = ({
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    ...rest
  }: Record<string, unknown>) => <div {...rest} />;
  return {
    motion: { div: Div },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function renderLayout() {
  return render(
    <MemoryRouter>
      <StudentAuthLayout topRight={<span>Don&apos;t have an account?</span>}>
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
    // Step through every slide, then check the rotation wraps back to the first.
    for (let i = 1; i <= STUDENT_SLIDES.length; i += 1) {
      await act(() => vi.advanceTimersByTimeAsync(SLIDE_INTERVAL_MS));
      expect(screen.getByText(STUDENT_SLIDES[i % STUDENT_SLIDES.length].title)).toBeInTheDocument();
    }
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

  it('puts CRF signing on the second slide only', () => {
    const withCrf = STUDENT_SLIDES.filter((s) => /CRF/.test(`${s.title} ${s.text}`));
    expect(withCrf).toHaveLength(1);
    expect(withCrf[0]).toBe(STUDENT_SLIDES[1]);
  });
});

describe('student sign-in layout: frame', () => {
  it('shows the brand mark top-left and the top-right link beside the card', () => {
    renderLayout();
    expect(screen.getByText('ADMIN PACK')).toBeInTheDocument();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('card content')).toBeInTheDocument();
  });

  it('has no department picker, which now lives on the sign-in page', () => {
    renderLayout();
    expect(screen.queryByRole('group', { name: 'Choose your department' })).not.toBeInTheDocument();
  });
});
